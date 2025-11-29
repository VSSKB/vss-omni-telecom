FROM debian:bullseye-slim

# Установка зависимостей
RUN apt-get update && apt-get install -y \
    asterisk \
    asterisk-pjsip \
    asterisk-mysql \
    asterisk-postgres \
    asterisk-voicemail \
    asterisk-mp3 \
    && rm -rf /var/lib/apt/lists/*

# Создание директорий для конфигурации
RUN mkdir -p /etc/asterisk

# Копирование конфигурации
COPY config/sip/asterisk/pjsip.conf /etc/asterisk/pjsip.conf
COPY config/sip/asterisk/extensions.conf /etc/asterisk/extensions.conf
COPY config/sip/asterisk/cdr.conf /etc/asterisk/cdr.conf
COPY config/sip/asterisk/modules.conf /etc/asterisk/modules.conf

# Порт SIP и RTP
EXPOSE 5060/udp 5060/tcp 10000-10099/udp

# Запуск Asterisk
CMD ["asterisk", "-f", "-vvv", "-c"]

