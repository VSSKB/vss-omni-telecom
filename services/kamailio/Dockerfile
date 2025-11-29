FROM debian:bullseye-slim

# Установка зависимостей и добавление репозитория Kamailio
RUN apt-get update && apt-get install -y \
    gnupg2 \
    curl \
    ca-certificates \
    && echo "deb http://deb.kamailio.org/kamailio57 bullseye main" > /etc/apt/sources.list.d/kamailio.list \
    && curl -o /tmp/kamailio.gpg http://deb.kamailio.org/kamailiodebkey.gpg \
    && apt-key add /tmp/kamailio.gpg \
    && rm /tmp/kamailio.gpg \
    && apt-get update && apt-get install -y \
    kamailio \
    kamailio-mysql-modules \
    kamailio-postgres-modules \
    kamailio-tls-modules \
    kamailio-utils-modules \
    kamailio-xml-modules \
    kamailio-presence-modules \
    kamailio-json-modules \
    && rm -rf /var/lib/apt/lists/*

# Копирование конфигурации
COPY config/sip/kamailio/kamailio.cfg /etc/kamailio/kamailio.cfg

# Порт SIP
EXPOSE 5060/udp 5060/tcp

# Запуск Kamailio
CMD ["kamailio", "-f", "/etc/kamailio/kamailio.cfg", "-DD", "-E"]

