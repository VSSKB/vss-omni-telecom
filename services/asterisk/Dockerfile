# VSS OMNI TELECOM - Asterisk 18 Production Container
# Полноценный контейнер Asterisk на основе официального образа

FROM andrius/asterisk:18-current

# Метаданные
LABEL maintainer="VSS Development Team"
LABEL description="Asterisk 18 IP-PBX для VSS OMNI TELECOM"
LABEL version="18.0"

# Переменные окружения
ENV POSTGRES_HOST=postgres \
    POSTGRES_PORT=5432 \
    POSTGRES_DB=vss_db \
    POSTGRES_USER=vss \
    POSTGRES_PASSWORD=vss_postgres_pass \
    AMI_PASSWORD=vss_ami_pass

# Установка дополнительных утилит
USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    curl \
    net-tools \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

# Скрипт инициализации базы данных
RUN cat > /usr/local/bin/init-asterisk-db.sh << 'EOF'
#!/bin/bash
set -e

echo "Инициализация базы данных Asterisk..."

PGHOST="${POSTGRES_HOST:-postgres}"
PGPORT="${POSTGRES_PORT:-5432}"
PGDATABASE="${POSTGRES_DB:-vss_db}"
PGUSER="${POSTGRES_USER:-vss}"
PGPASSWORD="${POSTGRES_PASSWORD:-vss_postgres_pass}"

export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD

# Ожидание доступности PostgreSQL
until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE"; do
  echo "Ожидание PostgreSQL..."
  sleep 2
done

echo "PostgreSQL доступен, создание таблиц..."

# Создание таблицы CDR если не существует
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" << 'SQL'
CREATE TABLE IF NOT EXISTS cdr_records (
    id SERIAL PRIMARY KEY,
    accountcode VARCHAR(20),
    from_number VARCHAR(80),
    to_number VARCHAR(80),
    context VARCHAR(80),
    clid VARCHAR(80),
    channel VARCHAR(80),
    dstchannel VARCHAR(80),
    lastapp VARCHAR(80),
    lastdata VARCHAR(80),
    start_time TIMESTAMP WITH TIME ZONE,
    answer_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER,
    billable_duration INTEGER,
    disposition VARCHAR(45),
    amaflags INTEGER,
    uniqueid VARCHAR(32),
    userfield VARCHAR(255),
    peeraccount VARCHAR(20),
    linkedid VARCHAR(32),
    sequence INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cdr_start_time ON cdr_records(start_time);
CREATE INDEX IF NOT EXISTS idx_cdr_uniqueid ON cdr_records(uniqueid);
CREATE INDEX IF NOT EXISTS idx_cdr_linkedid ON cdr_records(linkedid);
CREATE INDEX IF NOT EXISTS idx_cdr_from_number ON cdr_records(from_number);
CREATE INDEX IF NOT EXISTS idx_cdr_to_number ON cdr_records(to_number);
SQL

echo "База данных инициализирована"
EOF

RUN chmod +x /usr/local/bin/init-asterisk-db.sh

# Скрипт запуска Asterisk
RUN cat > /usr/local/bin/start-asterisk.sh << 'EOF'
#!/bin/bash
set -e

echo "=== VSS Asterisk Container Starting ==="

# Инициализация базы данных
/usr/local/bin/init-asterisk-db.sh

# Обновление конфигурации PostgreSQL в res_pgsql.conf
if [ -f /etc/asterisk/res_pgsql.conf ]; then
    if [ -n "$POSTGRES_HOST" ]; then
        sed -i "s|hostname=.*|hostname=$POSTGRES_HOST|" /etc/asterisk/res_pgsql.conf
    fi
    if [ -n "$POSTGRES_PORT" ]; then
        sed -i "s|port=.*|port=$POSTGRES_PORT|" /etc/asterisk/res_pgsql.conf
    fi
    if [ -n "$POSTGRES_DB" ]; then
        sed -i "s|dbname=.*|dbname=$POSTGRES_DB|" /etc/asterisk/res_pgsql.conf
    fi
    if [ -n "$POSTGRES_USER" ]; then
        sed -i "s|user=.*|user=$POSTGRES_USER|" /etc/asterisk/res_pgsql.conf
    fi
    if [ -n "$POSTGRES_PASSWORD" ]; then
        sed -i "s|password=.*|password=$POSTGRES_PASSWORD|" /etc/asterisk/res_pgsql.conf
    fi
fi

# Обновление пароля AMI
if [ -f /etc/asterisk/manager.conf ] && [ -n "$AMI_PASSWORD" ]; then
    if grep -q "^secret = " /etc/asterisk/manager.conf; then
        sed -i "s|^secret = .*|secret = $AMI_PASSWORD|" /etc/asterisk/manager.conf
    fi
fi

# Обновление CDR конфигурации
if [ -f /etc/asterisk/cdr.conf ] && [ -n "$POSTGRES_PASSWORD" ]; then
    DSN="postgresql://${POSTGRES_USER:-vss}:${POSTGRES_PASSWORD}@${POSTGRES_HOST:-postgres}:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-vss_db}"
    sed -i "s|dsn=.*|dsn=$DSN|" /etc/asterisk/cdr.conf
fi

echo "Конфигурация обновлена"
echo "Запуск Asterisk..."

# Запуск Asterisk в foreground режиме
exec asterisk -f -vvv -c
EOF

RUN chmod +x /usr/local/bin/start-asterisk.sh

# Порты
EXPOSE 5060/udp 5060/tcp 5038/tcp 10000-20000/udp

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD asterisk -rx "core show version" || exit 1

# Точка входа
ENTRYPOINT ["/usr/local/bin/start-asterisk.sh"]
