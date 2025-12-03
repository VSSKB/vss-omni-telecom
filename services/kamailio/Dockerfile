# VSS OMNI TELECOM - Kamailio 5.7 Production Container
# Полноценный контейнер Kamailio на основе Debian

FROM debian:bullseye-slim

# Метаданные
LABEL maintainer="VSS Development Team"
LABEL description="Kamailio 5.7 SIP Proxy для VSS OMNI TELECOM"
LABEL version="5.7.0"

# Переменные окружения
ENV POSTGRES_HOST=postgres \
    POSTGRES_PORT=5432 \
    POSTGRES_DB=vss_db \
    POSTGRES_USER=vss \
    POSTGRES_PASSWORD=vss_postgres_pass \
    KAMAILIO_DEBUG=3 \
    KAMAILIO_CHILDREN=4 \
    DEBIAN_FRONTEND=noninteractive

# Установка Kamailio из официального репозитория
RUN apt-get update && apt-get install -y --no-install-recommends \
    gnupg2 \
    curl \
    ca-certificates \
    && echo "deb http://deb.kamailio.org/kamailio57 bullseye main" > /etc/apt/sources.list.d/kamailio.list \
    && curl -o /tmp/kamailio.gpg http://deb.kamailio.org/kamailiodebkey.gpg \
    && apt-key add /tmp/kamailio.gpg \
    && rm /tmp/kamailio.gpg \
    && apt-get update && apt-get install -y --no-install-recommends \
    kamailio \
    kamailio-mysql-modules \
    kamailio-postgres-modules \
    kamailio-tls-modules \
    kamailio-utils-modules \
    kamailio-xml-modules \
    kamailio-presence-modules \
    kamailio-json-modules \
    postgresql-client \
    net-tools \
    iputils-ping \
    telnet \
    && rm -rf /var/lib/apt/lists/*

# Создание директорий для логов и данных
RUN mkdir -p /var/log/kamailio \
    /var/run/kamailio \
    /etc/kamailio/kamailio.d \
    && chown -R kamailio:kamailio /var/log/kamailio \
    /var/run/kamailio \
    /etc/kamailio

# Скрипт инициализации базы данных
RUN cat > /usr/local/bin/init-kamailio-db.sh << 'EOF'
#!/bin/bash
set -e

echo "Инициализация базы данных Kamailio..."

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

echo "PostgreSQL доступен, проверка таблиц..."

# Проверка и создание таблиц для Kamailio
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" << 'SQL'
-- Таблица для subscriber (аутентификация)
CREATE TABLE IF NOT EXISTS subscriber (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL DEFAULT '',
    domain VARCHAR(190) NOT NULL DEFAULT '',
    password VARCHAR(64) NOT NULL DEFAULT '',
    ha1 VARCHAR(128) NOT NULL DEFAULT '',
    ha1b VARCHAR(128) NOT NULL DEFAULT '',
    CONSTRAINT account_idx UNIQUE (username, domain)
);

CREATE INDEX IF NOT EXISTS idx_subscriber_username ON subscriber(username);
CREATE INDEX IF NOT EXISTS idx_subscriber_domain ON subscriber(domain);

-- Таблица для location (регистрации)
CREATE TABLE IF NOT EXISTS location (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL DEFAULT '',
    domain VARCHAR(190) DEFAULT NULL,
    contact VARCHAR(255) NOT NULL DEFAULT '',
    received VARCHAR(128) DEFAULT NULL,
    path VARCHAR(512) DEFAULT NULL,
    expires TIMESTAMP NOT NULL DEFAULT '2030-05-28 21:32:15',
    q REAL DEFAULT 1.0,
    callid VARCHAR(255) NOT NULL DEFAULT 'Default-Call-ID',
    cseq INTEGER NOT NULL DEFAULT 1,
    last_modified TIMESTAMP NOT NULL DEFAULT '1900-01-01 00:00:01',
    flags INTEGER NOT NULL DEFAULT 0,
    cflags INTEGER NOT NULL DEFAULT 0,
    user_agent VARCHAR(255) NOT NULL DEFAULT '',
    socket VARCHAR(128) DEFAULT NULL,
    methods INTEGER DEFAULT NULL,
    instance VARCHAR(255) DEFAULT NULL,
    reg_id INTEGER DEFAULT 0,
    server_id INTEGER DEFAULT 0,
    connection_id INTEGER DEFAULT 0,
    keepalive INTEGER DEFAULT 0,
    partition INTEGER DEFAULT 0,
    CONSTRAINT location_account_idx UNIQUE (username, domain, contact, callid)
);

CREATE INDEX IF NOT EXISTS idx_location_username ON location(username);
CREATE INDEX IF NOT EXISTS idx_location_domain ON location(domain);
CREATE INDEX IF NOT EXISTS idx_location_expires ON location(expires);
CREATE INDEX IF NOT EXISTS idx_location_contact ON location(contact);

-- Таблица для acc (accounting)
CREATE TABLE IF NOT EXISTS acc (
    id SERIAL PRIMARY KEY,
    method VARCHAR(16) NOT NULL DEFAULT '',
    from_tag VARCHAR(128) NOT NULL DEFAULT '',
    to_tag VARCHAR(128) NOT NULL DEFAULT '',
    callid VARCHAR(255) NOT NULL DEFAULT '',
    sip_code VARCHAR(3) NOT NULL DEFAULT '',
    sip_reason VARCHAR(128) NOT NULL DEFAULT '',
    time TIMESTAMP NOT NULL DEFAULT NOW(),
    duration INTEGER DEFAULT 0,
    ms_duration INTEGER DEFAULT 0,
    setuptime INTEGER DEFAULT 0,
    created TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acc_callid ON acc(callid);
CREATE INDEX IF NOT EXISTS idx_acc_time ON acc(time);
CREATE INDEX IF NOT EXISTS idx_acc_from_tag ON acc(from_tag);
CREATE INDEX IF NOT EXISTS idx_acc_to_tag ON acc(to_tag);

-- Таблица для missed_calls
CREATE TABLE IF NOT EXISTS missed_calls (
    id SERIAL PRIMARY KEY,
    method VARCHAR(16) NOT NULL DEFAULT '',
    from_tag VARCHAR(128) NOT NULL DEFAULT '',
    to_tag VARCHAR(128) NOT NULL DEFAULT '',
    callid VARCHAR(255) NOT NULL DEFAULT '',
    sip_code VARCHAR(3) NOT NULL DEFAULT '',
    sip_reason VARCHAR(128) NOT NULL DEFAULT '',
    time TIMESTAMP NOT NULL DEFAULT NOW(),
    setuptime INTEGER DEFAULT 0,
    created TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_missed_calls_callid ON missed_calls(callid);
CREATE INDEX IF NOT EXISTS idx_missed_calls_time ON missed_calls(time);

-- Таблица для dispatcher (load balancing)
CREATE TABLE IF NOT EXISTS dispatcher (
    id SERIAL PRIMARY KEY,
    setid INTEGER NOT NULL DEFAULT 0,
    destination VARCHAR(192) NOT NULL DEFAULT '',
    flags INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    attrs VARCHAR(128) NOT NULL DEFAULT '',
    description VARCHAR(64) NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_dispatcher_setid ON dispatcher(setid);
CREATE INDEX IF NOT EXISTS idx_dispatcher_destination ON dispatcher(destination);
SQL

echo "База данных инициализирована"
EOF

RUN chmod +x /usr/local/bin/init-kamailio-db.sh

# Скрипт запуска Kamailio
RUN cat > /usr/local/bin/start-kamailio.sh << 'EOF'
#!/bin/bash
set -e

echo "=== VSS Kamailio Container Starting ==="

# Инициализация базы данных
/usr/local/bin/init-kamailio-db.sh

# Обновление конфигурации из переменных окружения
if [ -f /etc/kamailio/kamailio.cfg ]; then
    # Замена строк подключения к БД
    DB_URL="postgresql://${POSTGRES_USER:-vss}:${POSTGRES_PASSWORD}@${POSTGRES_HOST:-postgres}:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-vss_db}"
    
    # Обновление всех db_url в конфигурации
    sed -i "s|db_url.*postgresql://.*|db_url\", \"$DB_URL\")|g" /etc/kamailio/kamailio.cfg
    
    # Обновление debug уровня
    if [ -n "$KAMAILIO_DEBUG" ]; then
        sed -i "s|^debug=.*|debug=$KAMAILIO_DEBUG|" /etc/kamailio/kamailio.cfg
    fi
    
    # Обновление количества процессов
    if [ -n "$KAMAILIO_CHILDREN" ]; then
        sed -i "s|^children=.*|children=$KAMAILIO_CHILDREN|" /etc/kamailio/kamailio.cfg
    fi
fi

# Проверка конфигурации
echo "Проверка конфигурации Kamailio..."
kamailio -C -f /etc/kamailio/kamailio.cfg

if [ $? -ne 0 ]; then
    echo "ОШИБКА: Конфигурация Kamailio неверна!"
    exit 1
fi

echo "Конфигурация валидна"
echo "Запуск Kamailio..."

# Запуск Kamailio в foreground режиме
exec kamailio -f /etc/kamailio/kamailio.cfg -DD -E -e
EOF

RUN chmod +x /usr/local/bin/start-kamailio.sh

# Порты
EXPOSE 5060/udp 5060/tcp

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD kamcmd core.ping || exit 1

# Точка входа
ENTRYPOINT ["/usr/local/bin/start-kamailio.sh"]
