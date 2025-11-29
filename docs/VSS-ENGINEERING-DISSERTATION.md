# VSS ENGINEERING DISSERTATION
## Volume I-V: Complete System Architecture

**VSS: Omni Telecom Trunk Builder + Distributed Control Infrastructure**

Версия: 1.0  
Статус: Финальный  
Формат: Markdown

---

## РАЗДЕЛ I — ОБЩИЕ ОСНОВЫ СИСТЕМЫ VSS

### 1. Введение

#### 1.1. Контекст и проблематика

Современные инфраструктуры медиа, VoIP, мобильных ферм и автоматизации подвержены фрагментации:
- Разные типы устройств
- Разные типы медиа-протоколов
- Отсутствие единого control-plane
- Отсутствие единой нумерации и SIP-контроля
- Раздельная телеметрия
- Раздельная автоматизация

VSS (Virtual System Stack) создан для объединения всех гетерогенных коммуникационных систем в единый управляемый комплекс.

#### 1.2. Научная идея проекта

**Главная исследовательская цель:**
Создать универсальный стек управления гетерогенными коммуникационными слотами в реальном времени с полной SIP-маршрутизацией, автоматизацией и контролем на уровне устройства, медиа и протокола.

**Ключевой научный вклад:**
1. Модель трёхкомпонентной плоскости (Control, Media, Access/Execution)
2. Внутренний SIP-транк как единый маршрутизатор слотов
3. DCI как распределённая mesh-инфраструктура исполнения
4. Полная декомпозиция автоматизации (AUTO, MF, LS)

### 2. Общая архитектура систем VSS

#### 2.1. Архитектурная модель верхнего уровня

```
┌────────────────────────────────────────────────┐
│          Frontend / Dashboard                   │
│   (Web UI, WS Telemetry, RBCG Engine)          │
└───────────────────────┬─────────────────────────┘
                        │ Control WS/API
                        ▼
┌────────────────────────────────────────────────┐
│              VSS HUB / MASTER                   │
│ Queue Engine | Slot Registry | API Core         │
└───────────────┬───────────────┬────────────────┘
                │               │
         (Control Plane)  (Media Routing Control)
                │               │
                ▼               ▼
     ┌────────────────┐   ┌────────────────────┐
     │  DCI EDGE NODES │   │ SIP TRUNK SERVICE  │
     │ AUTO/MF/LS slots│   │ Kamailio+Asterisk  │
     └────────────────┘   └────────────────────┘
            │ SIP/WS               │ SIP/RTP
            ▼                      ▼
      ┌───────────────┐     ┌───────────────────────┐
      │ Media Hosts   │     │ Internal Dialplan Core │
      │ RTMP / Audio  │     └───────────────────────┘
      └───────────────┘
            │ RTMP
            ▼
     ┌────────────────────────┐
     │ Live/Record/Analytics  │
     └────────────────────────┘
```

#### 2.2. Плоскости управления

1. **Control Plane**: Управление слотами, статусами, заданиями, GACS, DCI синхронизация
2. **Media Plane**: Обработка SIP, RTP, RTMP, аудио, видео
3. **Access/Execution Plane**: Исполнение ADB команд, Power management, auto-dial скриптов, GUI-автоматизации

### 3. Основные компоненты VSS

#### 3.1. VSS HUB
Главный мозг системы: Slot Registry, Master Queue, EventBus, API Gateway, Control Synthesizer, RBCG Engine, Telemetry

#### 3.2. VSS DCI
Распределённые исполнительные узлы с AUTO, MF, LS слотами, DRP, MediaBridge

#### 3.3. VSS OTTB
Центр телекоммуникационной логики: присвоение внутренних номеров, построение SIP маршрутов, выделение транков, привязка MF/AUTO/LS к SIP, создание dialplan

#### 3.4. SIP Trunk Service
Kamailio → routing, Asterisk → media processing

#### 3.5. Media Complex
NGINX-RTMP для потокового видео/аудио

### 4. Slot System

Три типа слотов:
- **AUTO** — автоматический софтфон
- **MF** — мобильная ферма (реальные смартфоны)
- **LS** — local script, автоматизация OS

Каждый слот получает:
- Внутренний SIP номер (97XXX для AUTO, 98XXX для MF, 99XXX для LS)
- Внутренний RTMP канал
- GACS профиль
- Контроль через HUB

---

## РАЗДЕЛ II — АРХИТЕКТУРА КОМПОНЕНТОВ VSS

### 7. VSS HUB — Архитектура

#### 7.1. Назначение HUB
HUB — главный центр принятия решений:
- Реестр слотов
- Внешнее API
- Планировщик задач
- Очереди для автодозвона (Lead Queue)
- Коммуникация с DCI через WS
- R.B.C.G. — Role-Based Content Generation
- Единый источник правды (Single Source of Truth)
- Управление SIP маршрутами в OTTB
- Контроль медиапотоков

#### 7.2. Внутренняя архитектура HUB

```
┌────────────────────────────────────────────┐
│              HUB MASTER                    │
├────────────────────────────────────────────┤
│ 1. API Gateway / HTTP Layer                │
│ 2. WS Dispatcher (telemetry/status)        │
│ 3. Queue Engine (RabbitMQ / RedisQ)        │
│ 4. Slot Registry (state DB + memory cache) │
│ 5. Scheduler & Workflows                   │
│ 6. GACS Script Dispatcher                  │
│ 7. Autodial Core                           │
│ 8. OTTB Sync Engine (SIP numbering)        │
│ 9. RBCG Engine (Role-Based Content Gen.)   │
└────────────────────────────────────────────┘
```

### 8. VSS DCI — Архитектура узла

#### 8.1. Назначение DCI
DCI — распределённые вычислительные узлы, исполняющие:
- Autodialer
- SIP вызов
- Контроль устройства
- GUI автоматизацию
- RTMP стриминг
- DRP-перезапуск

#### 8.2. Состав DCI узла

```
┌────────────────────────────────────────┐
│             DCI NODE                   │
├────────────────────────────────────────┤
│ 1. Slot Agent Supervisor               │
│ 2. Slot AUTO (VoIP softphone)          │
│ 3. Slot MF (Android device control)    │
│ 4. Slot LS (Local Script executor)     │
│ 5. Media Bridge (FFmpeg/AudioHost)     │
│ 6. SIP Agent (Kamailio/Asterisk client)│
│ 7. DRP Controller (Power/USB/OS-level) │
└────────────────────────────────────────┘
```

### 9. VSS OTTB — Omni Telecom Trunk Builder

#### 9.1. Назначение
OTTB — интеллектуальный конструктор телеком-системы:
- Генерирует внутренние SIP номера
- Создаёт SIP маршруты
- Создаёт dialplan
- Синхронизируется с Kamailio
- Генерирует профиль Asterisk
- Привязывает слоты AUTO/MF/LS к внутренним DID

#### 9.2. Архитектура OTTB

```
┌────────────────────────────────────────┐
│            OTTB CORE                   │
├────────────────────────────────────────┤
│ Numbering Engine                       │
│ Routing Engine                         │
│ Dialplan Builder                       │
│ PBX Sync Engine                        │
│ Slot Mapping (AUTO/MF/LS → SIP)        │
└────────────────────────────────────────┘
```

---

## РАЗДЕЛ III — СЛОТЫ AUTO / MF / LS

### 13. Терминология слотов

**SLOT** — минимальная автономная вычислительная единица, обладающая:
- SIP-индивидуальностью
- Возможностью принимать команды
- Собственным контроллером GUI/VoIP/OS
- Потоками логики и медиасессий

### 14. Общая архитектура любого SLOT

Каждый слот состоит из 4 обязательных внутренних ядров:

```
┌──────────────────────────────────────┐
│            SLOT CORE                 │
├──────────────────────────────────────┤
│ 1. CONTROL ENGINE (command handler) │
│ 2. MEDIA ENGINE (SIP/RTP/RTMP)      │
│ 3. ACCESS ENGINE (GACS/ADB/LS)      │
│ 4. DRP ENGINE (power-cycle/health)  │
└──────────────────────────────────────┘
```

### 15. Состояния слота (FSM)

Полная FSM:
```
IDLE
  ↓ assign
ASSIGNED
  ↓ open-sip
REGISTERING
  ↓ registered
READY
  ↓ call-start
CALLING
  ↓ answered
ACTIVE_CALL
  ↓ detect-end
POSTCALL
  ↓ done
IDLE

Ошибка → FAULT → HUB решает: перезапустить, перевести в DRP, пометить degraded
```

### 16. AUTO Slot (VoIP Softphone)

#### 16.1. Назначение
AUTO slot — это софтфон, полностью управляемый через HUB, с поддержкой:
- SIP INVITE
- RTP аудио
- DTMF
- Автодозвон
- Сценариев IVR
- GACS аудио-логики
- Воспроизведения TTS → RTP

### 17. MF Slot (Mobile Farming Slot)

MF slot — это комбинация:
- Физического/виртуального Android телефона
- ADB/GUI automation engine
- SIP endpoint (через Local Android VoIP app, WebRTC, или мост)
- RTMP/Video сборщик
- Комплект DRP-функций: перезагрузка, реконнект USB, очистка кэша

### 18. LS Slot (Local Script Slot)

LS — самый лёгкий вид слота. Он нужен для:
- Выполнения OS скриптов
- Запуска PowerShell/Bash
- Интеграции с внешними сервисами
- Подключения custom CLI
- Образования гибридных цепочек вида: AUTO → LS → MF → AUTO

---

## РАЗДЕЛ IV — UNIFIED SIP ARCHITECTURE

### 21. Введение в SIP архитектуру

**Главная цель:**
Создание единой внутренней VoIP-сети VSS OTTB, через которую соединяются:
- AUTO слоты
- MF слоты
- LS слоты (если имеют SIP-модуль)
- Внешние PSTN/SIP провайдеры
- Виртуальные сценарные IVR
- Медиасервисы

### 22. Общая схема SIP-слоя (Core SIP Graph)

```
                    ┌───────────────────────────────┐
                     │           VSS HUB              │
                     └──────────────┬────────────────┘
                                    │ REST/WS (Control)
                                    ▼
                       ┌────────────────────────┐
                       │      OTTB ROUTER       │
                       │  (dialplan compiler)   │
                       └──────────┬─────────────┘
                                  │gen dialplan
                                  ▼
 ┌────────────────────────────────────────────────────────────┐
 │                   SIP LAYER (VSS CALLNET)                   │
 │                                                            │
 │   ┌──────────────┐      SIP      ┌────────────────────┐    │
 │   │   KAMAILIO   │◀────────────▶│     ASTERISK        │    │
 │   │ (Registrar)  │   Dispatcher  │  (Media PBX/Mixer) │    │
 │   └──────────────┘              └────────────────────┘    │
 │        ▲         ▲                    ▲          ▲        │
 │        │REGISTER │                    │RTP       │CDR      │
 │        │INVITE   │                    │          │          │
 │        │         │                    │          │          │
 │   ┌────┴───┐   ┌─┴────┐      ┌────────┴──────┐  ┌─┴───────┐│
 │   │ AUTO   │   │  MF  │      │ LS (SIP opt)  │  │ PSTN/SIP ││
 │   └────────┘   └──────┘      └───────────────┘  └──────────┘│
 └────────────────────────────────────────────────────────────┘
```

### 24. Внутренняя SIP нумерация VSS

Каждому слоту присваивается внутренний номер:
- **97XXX** — AUTO слот
- **98XXX** — MF slot
- **99XXX** — LS slot
- **96XXX** — сервисы OTTB (IVR/flows)
- **95XXX** — внешние прокси

Примеры:
- AUTO#12 → 97012
- MF#05 → 98005
- LS#27 → 99027
- IVR#01 → 96001

---

## РАЗДЕЛ V — VSS DCI NODE ARCHITECTURE

### 36. Роль DCI в архитектуре OTTB

DCI — это физические и виртуальные периферийные узлы, на которых живут слоты:
- AUTO slot (Автодозвон, SIP)
- MF slot (Mobile Farm)
- LS slot (Local Script / Windows VM)
- HYBRID slot (совмещённые функции)

### 37. Макроархитектура DCI Node

```
                  ┌──────────────────────────────┐
                   │          VSS HUB             │
                   └──────────────┬───────────────┘
                                  │ WS/Queue/SSH/REST
                                  ▼
                  ┌────────────────────────────────┐
                  │       DCI CONTROL PLANE        │
                  │   (supervisor, orchestrator)   │
                  └─────────┬───────────────┬──────┘
                            │               │
                            │ Slot/Node Mgmt│ DRP/Power
                            ▼               ▼
         ┌───────────────────────────┐   ┌────────────────────────┐
         │    DCI EDGE NODE #1      │   │  DRP HOST (USB/RELAY)  │
         │ docker-compose / slots   │   │ uhubctl / relay-switch │
         └─────────┬───────────────┘   └───────────┬────────────┘
                   │                               │
                   ▼                               ▼
       ┌────────────────────┐         ┌────────────────────────┐
       │AUTO/MF/LS CONTAINERS│         │Physical Android / Modems│
       └────────────────────┘         └────────────────────────┘
```

---

## ПРИЛОЖЕНИЕ E — F-FLOW ТАБЛИЦА

### Полная таблица F-Flow потоков VSS OTTB

| F-Flow № | Название Потока | Протокол / Технология | Направление | Модуль / Компонент | Плоскость | Комментарий |
|----------|----------------|----------------------|-------------|-------------------|-----------|-------------|
| F-01 | Autodial Lead Queue | RabbitMQ / WS | HUB → Slot | Autodialer / Agent | Control | Доставка лидов для набора через Autodialer |
| F-02 | GACS Script Execution | SSH / ADB | HUB → Slot | GACS Executor | Access/Automation | GUI / Messenger скрипты (WhatsApp / Telegram) |
| F-03 | SIP Outbound Call | SIP / RTP | Slot → Kamailio | PJSIP / Asterisk Agent | Media | Исходящий звонок, регистрация и маршрутизация через SIP Trunk |
| F-04 | RTMP Video/Audio Push | RTMP / HLS / FFmpeg | Slot → NGINX RTMP | FFmpeg / Camera Capture | Media | Передача видео с устройства на Frontend |
| F-05 | Slot Status Sync | WS (Socket.IO) | Slot → HUB | HUB Master | Control | Обновление состояния слота (Ready, Busy, Error) |
| F-06 | Hardware DRP | uhubctl / SSH | DCI → Trunk Host | Power Cycle Module | DRP / Hardware | Аппаратный контроль USB питания слота |
| F-07 | Notification / Alerts | HTTPS API / Webhook | Slot → Notifier | Notifier Service | Control | P0/P1 алерты, события чата, интеграция с Slack / Telegram |
| F-08 | DB Logging / CDR | PostgreSQL / SQL | Slot → DCI @DCI DB | Logging / DB Writer | Access / Control | Логи выполнения, CDR, запись действий Autodialer и GACS |
| F-09 | SIP Registration | SIP | Slot → Kamailio | SIP Agent | Media | Регистрация слотов в Kamailio |
| F-10 | SIP Media RTP | RTP / RTCP | Slot ↔ Asterisk | SIP Agent / PBX | Media | Медиа-поток между слотом и Asterisk |
| F-11 | Campaign Status | WS / API | HUB → Slot | HUB Master | Control | Отчет об успешных / неуспешных наборах, статистика |
| F-12 | GACS Event Logging | WS / SQL / REST API | Slot → HUB / DCI | GACS Executor | Access/Automation | Логи выполнения скриптов, ошибки, статус завершения |
| F-13 | CDR Collection | PostgreSQL | SIP Trunk → @DCI DB | Asterisk / Kamailio | Media / Logging | Сбор CDR записей из Asterisk |
| F-14 | SIP Call Recording | RTP → Storage | SIP Trunk → Storage | Asterisk Recorder | Media / DRP | Запись звонков в аудио/видео формате |

---

## ЗАКЛЮЧЕНИЕ

VSS OTTB представляет собой комплексную промышленную платформу для управления гетерогенными коммуникационными слотами с полной SIP-маршрутизацией, автоматизацией и контролем на всех уровнях системы.

Система обеспечивает:
- Полную трассируемость всех операций через F-Flow потоки
- Масштабируемость до сотен слотов
- Интеграцию с внешними VoIP провайдерами
- Автоматическое восстановление через DRP
- Мониторинг в реальном времени
- Роль-ориентированный доступ (RBAC)

---

**Версия документа:** 1.0  
**Дата:** 2025-01-XX  
**Автор:** VSS Engineering Team

