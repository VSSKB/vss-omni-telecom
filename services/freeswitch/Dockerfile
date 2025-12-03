# FreeSWITCH Container для VSS OMNI TELECOM
FROM debian:bullseye-slim

LABEL maintainer="VSS OMNI TELECOM Team"
LABEL description="FreeSWITCH SIP Server для VSS Platform"

# Установка переменных окружения
ENV DEBIAN_FRONTEND=noninteractive
ENV FREESWITCH_VERSION=1.10.11

# Установка зависимостей
RUN apt-get update && apt-get install -y \
    wget \
    gnupg2 \
    ca-certificates \
    lsb-release \
    apt-transport-https \
    curl \
    vim \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

# Добавление официального репозитория FreeSWITCH
RUN wget --http-user=signalwire --http-password=pat_L6d4BKckKpPqPGk6RNXm7kKYzjdYFzXd9Q \
    -O - https://freeswitch.signalwire.com/repo/deb/debian-release/signalwire-freeswitch-repo.gpg | \
    gpg --dearmor -o /usr/share/keyrings/signalwire-freeswitch-repo.gpg

RUN echo "deb [signed-by=/usr/share/keyrings/signalwire-freeswitch-repo.gpg] \
    https://freeswitch.signalwire.com/repo/deb/debian-release/ \
    $(lsb_release -sc) main" > /etc/apt/sources.list.d/freeswitch.list

# Установка FreeSWITCH
RUN apt-get update && apt-get install -y \
    freeswitch-meta-all \
    freeswitch-mod-commands \
    freeswitch-mod-console \
    freeswitch-mod-logfile \
    freeswitch-mod-db \
    freeswitch-mod-dptools \
    freeswitch-mod-expr \
    freeswitch-mod-fifo \
    freeswitch-mod-hash \
    freeswitch-mod-spandsp \
    freeswitch-mod-esf \
    freeswitch-mod-fsv \
    freeswitch-mod-cluechoo \
    freeswitch-mod-valet-parking \
    freeswitch-mod-httapi \
    freeswitch-mod-dialplan-xml \
    freeswitch-mod-dialplan-asterisk \
    freeswitch-mod-spandsp \
    freeswitch-mod-g723-1 \
    freeswitch-mod-g729 \
    freeswitch-mod-h26x \
    freeswitch-mod-amr \
    freeswitch-mod-ilbc \
    freeswitch-mod-isac \
    freeswitch-mod-mp3 \
    freeswitch-mod-opus \
    freeswitch-mod-silk \
    freeswitch-mod-sndfile \
    freeswitch-mod-local-stream \
    freeswitch-mod-native-file \
    freeswitch-mod-tone-stream \
    freeswitch-mod-lua \
    freeswitch-mod-say-en \
    freeswitch-mod-say-ru \
    freeswitch-mod-event-socket \
    freeswitch-mod-sofia \
    freeswitch-mod-loopback \
    freeswitch-mod-commands \
    freeswitch-mod-conference \
    freeswitch-mod-db \
    freeswitch-mod-dptools \
    freeswitch-mod-expr \
    freeswitch-mod-fifo \
    freeswitch-mod-hash \
    freeswitch-mod-esl \
    freeswitch-mod-esf \
    freeswitch-mod-fsv \
    freeswitch-mod-valet-parking \
    freeswitch-mod-httapi \
    freeswitch-mod-callcenter \
    freeswitch-mod-voicemail \
    freeswitch-mod-pgsql \
    && rm -rf /var/lib/apt/lists/*

# Создание необходимых директорий
RUN mkdir -p /var/log/freeswitch \
    /var/lib/freeswitch \
    /var/run/freeswitch \
    /etc/freeswitch

# Установка прав доступа
RUN chown -R freeswitch:freeswitch \
    /var/log/freeswitch \
    /var/lib/freeswitch \
    /var/run/freeswitch \
    /etc/freeswitch

# Открытие портов
# 5080 - SIP UDP/TCP
# 5081 - SIP TLS
# 8021 - Event Socket
# 16384-32768 - RTP
EXPOSE 5080/tcp 5080/udp 5081/tcp 5081/udp 8021/tcp
EXPOSE 16384-32768/udp

# Переключение на пользователя freeswitch
USER freeswitch

# Точка входа
ENTRYPOINT ["/usr/bin/freeswitch"]
CMD ["-nonat", "-nf"]

