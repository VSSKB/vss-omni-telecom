# 🐰 Руководство по использованию RabbitMQ в VSS DEMIURGE

## 📋 Содержание
1. [Что такое RabbitMQ и зачем он нужен](#что-такое-rabbitmq)
2. [Архитектура RabbitMQ в VSS](#архитектура-rabbitmq-в-vss)
3. [Базовые понятия](#базовые-понятия)
4. [Структура обменников и очередей](#структура-обменников-и-очередей)
5. [Как публиковать сообщения](#как-публиковать-сообщения)
6. [Как получать сообщения](#как-получать-сообщения)
7. [Практические примеры](#практические-примеры)
8. [Управление через веб-интерфейс](#управление-через-веб-интерфейс)
9. [Мониторинг и отладка](#мониторинг-и-отладка)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Что такое RabbitMQ

**RabbitMQ** - это брокер сообщений (message broker), который позволяет различным сервисам обмениваться информацией асинхронно.

### Зачем нужен в VSS DEMIURGE?

В проекте VSS DEMIURGE есть несколько сервисов:
- **WORKSPACE** (порт 3000) - Пользовательский интерфейс
- **OTTB** (порт 8083) - Управление звонками и слотами
- **DCI** (порт 8082) - Управление данными и CI/CD
- **POINT** (порт 8081) - Аутентификация и безопасность

RabbitMQ соединяет эти сервисы, позволяя им общаться между собой без прямых зависимостей.

### Пример использования

```
┌──────────┐                  ┌──────────┐                  ┌──────────┐
│   OTTB   │  --события-->    │ RabbitMQ │  --события-->    │WORKSPACE │
│          │  звонков          │          │                  │          │
└──────────┘                  └──────────┘                  └──────────┘
                                    │
                                    │ команды
                                    ▼
                              ┌──────────┐
                              │   DCI    │
                              │ обработка│
                              └──────────┘
```

---

## 🏗️ Архитектура RabbitMQ в VSS

### Ключевые компоненты

```
┌─────────────────────────────────────────────────────────┐
│                    RABBITMQ SERVER                       │
│  VHost: /vss                                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📮 EXCHANGES (Обменники)                               │
│  ├── vss.events     [topic]  - События системы          │
│  ├── vss.commands   [topic]  - Команды                  │
│  └── vss.rpc        [direct] - RPC вызовы               │
│                                                          │
│  📦 QUEUES (Очереди)                                    │
│  ├── vss.call.events         - События звонков          │
│  ├── vss.slot.events         - События слотов           │
│  ├── vss.autodial.leads      - Лиды для автодозвона     │
│  ├── vss.gacs.commands       - GUI автоматизация        │
│  ├── vss.pipeline.events     - CI/CD пайплайны          │
│  ├── vss.system.alerts       - Системные алерты         │
│  ├── vss.guacamole.sessions  - Guacamole сессии         │
│  ├── vss.archonts.deployments - ARCHONTS деплой         │
│  └── vss.telemetry.metrics   - Телеметрия               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 📚 Базовые понятия

### 1. Exchange (Обменник)
**Принимает** сообщения от сервисов и **маршрутизирует** их в очереди.

**Типы:**
- **topic** - маршрутизация по шаблону (pattern), например `call.*` включает `call.start`, `call.end`
- **direct** - точная маршрутизация по ключу

### 2. Queue (Очередь)
**Хранит** сообщения до тех пор, пока они не будут обработаны.

### 3. Routing Key (Ключ маршрутизации)
**Определяет**, в какую очередь попадет сообщение.

Примеры:
- `call.start` → очередь `vss.call.events`
- `slot.update` → очередь `vss.slot.events`
- `autodial.lead` → очередь `vss.autodial.leads`

### 4. Binding (Привязка)
**Связывает** обменник с очередью через routing key.

```
Exchange: vss.events  →  Routing Key: call.*  →  Queue: vss.call.events
```

---

## 🗂️ Структура обменников и очередей

### Exchange: `vss.events` (События)

Используется для **публикации событий** системы.

| Routing Key | Очередь | Описание |
|------------|---------|----------|
| `call.start` | vss.call.events | Начало звонка |
| `call.end` | vss.call.events | Завершение звонка |
| `call.update` | vss.call.events | Обновление статуса звонка |
| `slot.update` | vss.slot.events | Обновление статуса слота |
| `slot.restart` | vss.slot.events | Перезапуск слота |
| `pipeline.start` | vss.pipeline.events | Запуск пайплайна |
| `system.alert` | vss.system.alerts | Системный алерт |
| `guacamole.session.start` | vss.guacamole.sessions | Начало Guacamole сессии |
| `telemetry.*` | vss.telemetry.metrics | Телеметрия |

### Exchange: `vss.commands` (Команды)

Используется для **отправки команд** сервисам.

| Routing Key | Очередь | Описание |
|------------|---------|----------|
| `slot.restart` | vss.slot.commands | Перезапуск слота |
| `slot.drp.reboot` | vss.slot.commands | Перезагрузка DRP |
| `autodial.lead` | vss.autodial.leads | Лид для автодозвона (F-01) |
| `gacs.execute` | vss.gacs.commands | Выполнение GACS команды |

### Очереди и их настройки

| Очередь | TTL | Max Length | Dead Letter |
|---------|-----|------------|-------------|
| vss.call.events | 24 часа | 10,000 | - |
| vss.slot.events | 24 часа | 10,000 | - |
| vss.autodial.leads | 1 час | 50,000 | - |
| vss.gacs.commands | - | - | vss.events (command.failed) |
| vss.system.alerts | 7 дней | 5,000 | - |
| vss.telemetry.metrics | 1 час | 100,000 | - |

**TTL** (Time To Live) - время жизни сообщения. После истечения TTL сообщение автоматически удаляется.

**Dead Letter Exchange** - если команда не была обработана, она попадает сюда для дальнейшего анализа.

---

## 📤 Как публиковать сообщения

### Подключение к RabbitMQ

```javascript
const amqp = require('amqplib');

// URL подключения
const RABBITMQ_URL = process.env.RABBITMQ_URL || 
    'amqp://vss-admin:vss_rabbit_pass@localhost:5672/vss';

// Создаем подключение
const connection = await amqp.connect(RABBITMQ_URL);
const channel = await connection.createChannel();

// Убеждаемся, что обменники существуют
await channel.assertExchange('vss.events', 'topic', { durable: true });
await channel.assertExchange('vss.commands', 'topic', { durable: true });
```

### Пример 1: Публикация события звонка

```javascript
// Начало звонка
const publishCallStart = async (callData) => {
    const eventData = {
        event: 'call.start',
        timestamp: new Date().toISOString(),
        call_id: callData.call_id,
        slot_id: callData.slot_id,
        phone_number: callData.phone_number,
        operator_id: callData.operator_id
    };
    
    // Публикуем в exchange 'vss.events' с routing key 'call.start'
    channel.publish(
        'vss.events',                          // exchange
        'call.start',                          // routing key
        Buffer.from(JSON.stringify(eventData)), // message
        { 
            persistent: true,                  // сохранить на диск
            contentType: 'application/json'    // тип контента
        }
    );
    
    console.log('[OTTB] 📤 Опубликовано событие call.start:', callData.call_id);
};

// Использование
await publishCallStart({
    call_id: 'c_1234',
    slot_id: 44,
    phone_number: '+79991234567',
    operator_id: 'op1'
});
```

### Пример 2: Публикация обновления слота

```javascript
// Обновление статуса слота
const publishSlotUpdate = async (slotId, status) => {
    const eventData = {
        event: 'slot.update',
        timestamp: new Date().toISOString(),
        slot_id: slotId,
        status: status,  // 'free', 'busy', 'offline'
        metadata: {
            cpu_usage: 45.2,
            ram_usage: 1024,
            battery: 85
        }
    };
    
    channel.publish(
        'vss.events',
        'slot.update',
        Buffer.from(JSON.stringify(eventData)),
        { persistent: true }
    );
    
    console.log(`[OTTB] 📤 Слот ${slotId} статус: ${status}`);
};

// Использование
await publishSlotUpdate(44, 'busy');
```

### Пример 3: Отправка команды автодозвона (F-01)

```javascript
// Отправка лида для автодозвона
const sendAutodialLead = async (leadData) => {
    const commandData = {
        command: 'autodial.lead',
        timestamp: new Date().toISOString(),
        lead_id: leadData.lead_id,
        phone_number: leadData.phone_number,
        campaign_id: leadData.campaign_id,
        priority: leadData.priority || 5,
        metadata: leadData.metadata || {}
    };
    
    channel.publish(
        'vss.commands',        // exchange
        'autodial.lead',       // routing key
        Buffer.from(JSON.stringify(commandData)),
        { 
            persistent: true,
            priority: commandData.priority  // приоритет сообщения
        }
    );
    
    console.log('[OTTB] 📤 Отправлен лид для автодозвона:', leadData.lead_id);
};

// Использование
await sendAutodialLead({
    lead_id: 'lead_5678',
    phone_number: '+79991234567',
    campaign_id: 'campaign_123',
    priority: 10,
    metadata: {
        client_name: 'Иван Иванов',
        lead_source: 'website'
    }
});
```

### Пример 4: Отправка GACS команды (F-02)

```javascript
// Выполнение GUI автоматизации
const executeGacsCommand = async (slotId, scriptName, params) => {
    const commandData = {
        command: 'gacs.execute',
        timestamp: new Date().toISOString(),
        slot_id: slotId,
        script_name: scriptName,
        params: params
    };
    
    channel.publish(
        'vss.commands',
        'gacs.execute',
        Buffer.from(JSON.stringify(commandData)),
        { persistent: true }
    );
    
    console.log(`[OTTB] 📤 GACS команда отправлена на слот ${slotId}`);
};

// Использование
await executeGacsCommand(44, 'open_dialer_app', {
    phone_number: '+79991234567',
    auto_call: true
});
```

### Пример 5: Системные алерты

```javascript
// Отправка системного алерта
const sendSystemAlert = async (severity, message, details) => {
    const alertData = {
        event: 'system.alert',
        timestamp: new Date().toISOString(),
        severity: severity,  // 'info', 'warning', 'error', 'critical'
        message: message,
        details: details,
        source: 'OTTB'
    };
    
    channel.publish(
        'vss.events',
        'system.alert',
        Buffer.from(JSON.stringify(alertData)),
        { persistent: true }
    );
    
    console.log(`[OTTB] ⚠️ Системный алерт [${severity}]: ${message}`);
};

// Использование
await sendSystemAlert('warning', 'Слот 44 не отвечает', {
    slot_id: 44,
    last_seen: '2025-01-15T14:30:00Z',
    attempts: 5
});
```

---

## 📥 Как получать сообщения

### Пример 1: Подписка на события звонков (Workspace)

```javascript
// Подключаемся к RabbitMQ
const connection = await amqp.connect(RABBITMQ_URL);
const channel = await connection.createChannel();

// Убеждаемся, что очередь существует
await channel.assertQueue('vss.call.events', { durable: true });

// Подписываемся на очередь
channel.consume('vss.call.events', async (msg) => {
    if (msg !== null) {
        try {
            const eventData = JSON.parse(msg.content.toString());
            console.log('[WORKSPACE] 📥 Получено событие звонка:', eventData);
            
            // Обрабатываем событие
            switch(eventData.event) {
                case 'call.start':
                    console.log(`Звонок ${eventData.call_id} начат`);
                    // Отправляем обновление клиентам через WebSocket
                    io.emit('call:started', eventData);
                    break;
                    
                case 'call.end':
                    console.log(`Звонок ${eventData.call_id} завершен`);
                    io.emit('call:ended', eventData);
                    break;
                    
                case 'call.update':
                    console.log(`Звонок ${eventData.call_id} обновлен`);
                    io.emit('call:updated', eventData);
                    break;
            }
            
            // Подтверждаем обработку сообщения
            channel.ack(msg);
            
        } catch (error) {
            console.error('[WORKSPACE] ❌ Ошибка обработки события:', error);
            // Отклоняем сообщение и отправляем обратно в очередь
            channel.nack(msg, false, true);
        }
    }
}, {
    noAck: false  // Требуем явного подтверждения
});

console.log('[WORKSPACE] 🎧 Подписка на события звонков активна');
```

### Пример 2: Обработка автодозвона (DCI)

```javascript
// DCI обрабатывает лиды для автодозвона
await channel.assertQueue('vss.autodial.leads', { durable: true });

channel.consume('vss.autodial.leads', async (msg) => {
    if (msg !== null) {
        try {
            const leadData = JSON.parse(msg.content.toString());
            console.log('[DCI] 📥 Получен лид для автодозвона:', leadData.lead_id);
            
            // Находим свободный слот
            const availableSlot = await findAvailableSlot();
            
            if (availableSlot) {
                console.log(`[DCI] ✅ Назначаем слот ${availableSlot.id} для лида ${leadData.lead_id}`);
                
                // Инициируем звонок
                await initiateCall(availableSlot.id, leadData.phone_number);
                
                // Публикуем событие о начале звонка
                channel.publish('vss.events', 'call.start', 
                    Buffer.from(JSON.stringify({
                        call_id: `c_${Date.now()}`,
                        slot_id: availableSlot.id,
                        phone_number: leadData.phone_number,
                        lead_id: leadData.lead_id,
                        campaign_id: leadData.campaign_id
                    }))
                );
                
                channel.ack(msg);
            } else {
                console.log('[DCI] ⚠️ Нет свободных слотов, возвращаем лид в очередь');
                // Возвращаем в очередь с задержкой
                setTimeout(() => {
                    channel.nack(msg, false, true);
                }, 5000);  // Повтор через 5 секунд
            }
            
        } catch (error) {
            console.error('[DCI] ❌ Ошибка обработки лида:', error);
            channel.nack(msg, false, true);
        }
    }
}, { noAck: false });

console.log('[DCI] 🎧 Обработка автодозвона активна');
```

### Пример 3: Обработка GACS команд (DCI)

```javascript
await channel.assertQueue('vss.gacs.commands', { durable: true });

channel.consume('vss.gacs.commands', async (msg) => {
    if (msg !== null) {
        try {
            const commandData = JSON.parse(msg.content.toString());
            console.log(`[DCI] 📥 GACS команда для слота ${commandData.slot_id}`);
            
            // Выполняем GACS скрипт через ADB/SSH
            const result = await executeGacsScript(
                commandData.slot_id,
                commandData.script_name,
                commandData.params
            );
            
            if (result.success) {
                console.log('[DCI] ✅ GACS команда выполнена успешно');
                
                // Публикуем событие успеха
                channel.publish('vss.events', 'gacs.completed',
                    Buffer.from(JSON.stringify({
                        slot_id: commandData.slot_id,
                        script_name: commandData.script_name,
                        result: result
                    }))
                );
                
                channel.ack(msg);
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('[DCI] ❌ Ошибка выполнения GACS:', error);
            
            // Публикуем событие ошибки
            channel.publish('vss.events', 'gacs.failed',
                Buffer.from(JSON.stringify({
                    slot_id: commandData.slot_id,
                    error: error.message
                }))
            );
            
            // Отклоняем сообщение (попадет в dead letter exchange)
            channel.nack(msg, false, false);
        }
    }
}, { noAck: false });
```

### Пример 4: Мониторинг системных алертов

```javascript
await channel.assertQueue('vss.system.alerts', { durable: true });

channel.consume('vss.system.alerts', async (msg) => {
    if (msg !== null) {
        try {
            const alertData = JSON.parse(msg.content.toString());
            console.log(`[WORKSPACE] ⚠️ Системный алерт [${alertData.severity}]: ${alertData.message}`);
            
            // Обрабатываем алерт в зависимости от серьезности
            switch(alertData.severity) {
                case 'critical':
                    // Отправляем уведомление администраторам
                    io.to('admins').emit('system:critical-alert', alertData);
                    // Логируем в БД
                    await logCriticalAlert(alertData);
                    break;
                    
                case 'error':
                    io.to('admins').emit('system:error', alertData);
                    break;
                    
                case 'warning':
                    io.to('supervisors').emit('system:warning', alertData);
                    break;
                    
                case 'info':
                    console.log('[WORKSPACE] ℹ️ Информационное сообщение:', alertData.message);
                    break;
            }
            
            channel.ack(msg);
            
        } catch (error) {
            console.error('[WORKSPACE] ❌ Ошибка обработки алерта:', error);
            channel.nack(msg, false, true);
        }
    }
}, { noAck: false });
```

---

## 🎨 Практические примеры

### Полный пример: Цикл звонка (F-Flow)

#### 1. OTTB: Начало звонка

```javascript
// services/ottb/routes/calls.js
app.post('/api/call/start', async (req, res) => {
    const { slot_id, phone_number, operator_id } = req.body;
    
    // Создаем запись в БД
    const call = await pool.query(
        'INSERT INTO calls (slot_id, phone_number, operator_id, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [slot_id, phone_number, operator_id, 'initiating']
    );
    
    const callId = call.rows[0].id;
    
    // Публикуем событие в RabbitMQ
    channel.publish('vss.events', 'call.start', 
        Buffer.from(JSON.stringify({
            event: 'call.start',
            timestamp: new Date().toISOString(),
            call_id: callId,
            slot_id: slot_id,
            phone_number: phone_number,
            operator_id: operator_id
        })),
        { persistent: true }
    );
    
    res.json({ success: true, call_id: callId });
});
```

#### 2. DCI: Обработка команды звонка

```javascript
// services/dci/index.js
channel.consume('vss.call.events', async (msg) => {
    const eventData = JSON.parse(msg.content.toString());
    
    if (eventData.event === 'call.start') {
        console.log(`[DCI] Обработка звонка ${eventData.call_id}`);
        
        // Инициируем SIP звонок (F-03)
        await initiateSipCall(eventData.slot_id, eventData.phone_number);
        
        // Публикуем обновление статуса слота
        channel.publish('vss.events', 'slot.update',
            Buffer.from(JSON.stringify({
                slot_id: eventData.slot_id,
                status: 'busy',
                current_call: eventData.call_id
            }))
        );
        
        channel.ack(msg);
    }
});
```

#### 3. WORKSPACE: Отправка обновлений клиентам

```javascript
// services/workspace/index.js
channel.consume('vss.call.events', async (msg) => {
    const eventData = JSON.parse(msg.content.toString());
    
    // Отправляем через WebSocket всем подключенным клиентам
    io.emit('call:update', eventData);
    
    // Отправляем конкретному оператору
    if (eventData.operator_id) {
        io.to(eventData.operator_id).emit('call:personal-update', eventData);
    }
    
    channel.ack(msg);
});

// WebSocket подключение от клиента
io.on('connection', (socket) => {
    console.log('[WORKSPACE] Клиент подключен:', socket.id);
    
    // Клиент подписывается на обновления звонков
    socket.on('subscribe:calls', (operatorId) => {
        socket.join(operatorId);
        console.log(`[WORKSPACE] Оператор ${operatorId} подписан на обновления`);
    });
});
```

#### 4. Фронтенд: Получение обновлений

```javascript
// Frontend JavaScript
const socket = io('http://localhost:3000');

// Подписываемся на обновления
socket.emit('subscribe:calls', operatorId);

// Слушаем события звонков
socket.on('call:update', (data) => {
    console.log('Получено обновление звонка:', data);
    updateCallUI(data);
});

socket.on('call:started', (data) => {
    showNotification(`Звонок начат на слот ${data.slot_id}`);
    updateCallList(data);
});

socket.on('call:ended', (data) => {
    showNotification(`Звонок завершен`);
    removeCallFromList(data.call_id);
});
```

### Пример: Запуск кампании автодозвона

```javascript
// services/ottb/routes/autodialer.js
app.post('/api/autodialer/run-campaign', async (req, res) => {
    const { campaign_id, lead_list } = req.body;
    
    console.log(`[OTTB] Запуск кампании ${campaign_id} с ${lead_list.length} лидами`);
    
    // Помещаем лиды в очередь RabbitMQ
    for (const lead of lead_list) {
        channel.publish('vss.commands', 'autodial.lead',
            Buffer.from(JSON.stringify({
                command: 'autodial.lead',
                timestamp: new Date().toISOString(),
                lead_id: lead.id,
                phone_number: lead.phone,
                campaign_id: campaign_id,
                priority: lead.priority || 5,
                metadata: {
                    client_name: lead.name,
                    lead_source: lead.source
                }
            })),
            { 
                persistent: true,
                priority: lead.priority || 5
            }
        );
    }
    
    res.json({ 
        success: true, 
        message: `${lead_list.length} лидов добавлено в очередь` 
    });
});
```

---

## 🖥️ Управление через веб-интерфейс

### Доступ к RabbitMQ Management UI

1. **Откройте браузер:**
   ```
   http://localhost:15672
   ```

2. **Введите учетные данные:**
   - Username: `vss-admin`
   - Password: `vss_rabbit_pass`

3. **Выберите VHost:**
   - В правом верхнем углу выберите: `/vss`

### Основные разделы

#### 📊 Overview (Обзор)
- Общая статистика системы
- Количество подключений
- Количество очередей и сообщений
- Скорость публикации/потребления

#### 📮 Exchanges (Обменники)
Здесь вы увидите:
- `vss.events` - для событий
- `vss.commands` - для команд
- `vss.rpc` - для RPC

**Что можно сделать:**
- Посмотреть bindings (привязки к очередям)
- Опубликовать тестовое сообщение
- Удалить обменник (⚠️ осторожно!)

#### 📦 Queues (Очереди)
Список всех очередей с информацией:
- Количество сообщений
- Скорость публикации
- Скорость потребления
- Количество потребителей (consumers)

**Полезные действия:**
1. **Просмотр сообщений:**
   - Кликните на название очереди
   - Раздел "Get messages"
   - Укажите количество (например, 10)
   - Нажмите "Get Message(s)"

2. **Очистка очереди:**
   - Кликните на название очереди
   - Внизу кнопка "Purge Messages"
   - ⚠️ Все сообщения будут удалены!

3. **Публикация тестового сообщения:**
   - Кликните на название очереди
   - Раздел "Publish message"
   - Введите JSON
   - Нажмите "Publish message"

#### 🔗 Connections (Подключения)
Список всех активных подключений:
- Какие сервисы подключены
- IP адреса
- Количество каналов

#### 📡 Channels (Каналы)
Детальная информация о каналах:
- Через какой канал публикуются сообщения
- Скорость работы
- Ошибки

---

## 🔍 Мониторинг и отладка

### Проверка статуса RabbitMQ

#### PowerShell скрипт для проверки

```powershell
# verify-rabbitmq.ps1
$rabbitUrl = "http://localhost:15672/api"
$vhost = "%2Fvss"  # URL-encoded /vss
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("vss-admin:vss_rabbit_pass"))
$headers = @{
    Authorization = "Basic $auth"
}

Write-Host "🐰 Проверка RabbitMQ..." -ForegroundColor Cyan

# Проверяем exchanges
Write-Host "`n📮 Exchanges:" -ForegroundColor Yellow
$exchanges = Invoke-RestMethod -Uri "$rabbitUrl/exchanges/$vhost" -Headers $headers
$exchanges | Where-Object { $_.name -like "vss.*" } | ForEach-Object {
    Write-Host "  ✓ $($_.name) [$($_.type)]" -ForegroundColor Green
}

# Проверяем queues
Write-Host "`n📦 Queues:" -ForegroundColor Yellow
$queues = Invoke-RestMethod -Uri "$rabbitUrl/queues/$vhost" -Headers $headers
$queues | Where-Object { $_.name -like "vss.*" } | ForEach-Object {
    $msgCount = $_.messages
    $consumers = $_.consumers
    Write-Host "  ✓ $($_.name) - Сообщений: $msgCount, Потребителей: $consumers" -ForegroundColor Green
}

# Проверяем bindings
Write-Host "`n🔗 Bindings:" -ForegroundColor Yellow
$bindings = Invoke-RestMethod -Uri "$rabbitUrl/bindings/$vhost" -Headers $headers
$bindings | Where-Object { $_.source -like "vss.*" } | ForEach-Object {
    Write-Host "  ✓ $($_.source) → $($_.destination) [$($_.routing_key)]" -ForegroundColor Green
}

Write-Host "`n✅ Проверка завершена!" -ForegroundColor Green
```

**Запуск:**
```powershell
.\verify-rabbitmq.ps1
```

### Логирование RabbitMQ событий

```javascript
// Добавьте в ваш сервис
const logRabbitMQEvent = async (type, routingKey, data) => {
    const logEntry = {
        timestamp: new Date().toISOString(),
        service: 'OTTB',  // или WORKSPACE, DCI, etc.
        type: type,       // 'publish' или 'consume'
        routing_key: routingKey,
        data: data
    };
    
    // Логируем в файл
    console.log(`[RabbitMQ] ${type.toUpperCase()} ${routingKey}:`, data);
    
    // Опционально: сохраняем в БД для аналитики
    await pool.query(
        'INSERT INTO rabbitmq_log (timestamp, service, type, routing_key, data) VALUES ($1, $2, $3, $4, $5)',
        [logEntry.timestamp, logEntry.service, logEntry.type, logEntry.routing_key, JSON.stringify(logEntry.data)]
    );
};

// Использование
await logRabbitMQEvent('publish', 'call.start', eventData);
```

### Мониторинг производительности

```javascript
// Метрики RabbitMQ
app.get('/api/rabbitmq/metrics', async (req, res) => {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        
        const metrics = {
            exchanges: {},
            queues: {}
        };
        
        // Получаем информацию об очередях
        const queues = [
            'vss.call.events',
            'vss.slot.events',
            'vss.autodial.leads',
            'vss.gacs.commands'
        ];
        
        for (const queueName of queues) {
            const queueInfo = await channel.checkQueue(queueName);
            metrics.queues[queueName] = {
                messageCount: queueInfo.messageCount,
                consumerCount: queueInfo.consumerCount
            };
        }
        
        await connection.close();
        
        res.json(metrics);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

---

## 🔧 Troubleshooting

### Проблема 1: Сообщения не доставляются

**Симптом:** Публикуете сообщение, но оно не появляется в очереди.

**Решения:**

1. **Проверьте routing key:**
   ```javascript
   // Убедитесь, что routing key соответствует binding
   // Неправильно:
   channel.publish('vss.events', 'calls.start', ...);  // ❌
   
   // Правильно:
   channel.publish('vss.events', 'call.start', ...);   // ✅
   ```

2. **Проверьте exchange:**
   ```javascript
   // Убедитесь, что exchange существует
   await channel.assertExchange('vss.events', 'topic', { durable: true });
   ```

3. **Проверьте bindings в Management UI:**
   - Откройте http://localhost:15672
   - Перейдите в Exchanges → vss.events
   - Проверьте Bindings

### Проблема 2: Сообщения накапливаются в очереди

**Симптом:** Сообщения попадают в очередь, но не обрабатываются.

**Решения:**

1. **Проверьте, что consumer запущен:**
   ```javascript
   // Убедитесь, что есть активный consumer
   channel.consume('vss.call.events', handleMessage, { noAck: false });
   ```

2. **Проверьте ошибки в consumer:**
   ```javascript
   channel.consume('vss.call.events', async (msg) => {
       try {
           const data = JSON.parse(msg.content.toString());
           await processMessage(data);
           channel.ack(msg);  // ✅ Важно подтвердить!
       } catch (error) {
           console.error('Ошибка обработки:', error);
           channel.nack(msg, false, true);  // Вернуть в очередь
       }
   });
   ```

3. **Проверьте количество consumers в Management UI:**
   - Queues → vss.call.events
   - Если "Consumers: 0" - consumer не запущен!

### Проблема 3: RabbitMQ недоступен

**Симптом:** `Error: getaddrinfo ENOTFOUND rabbitmq`

**Решения:**

1. **Проверьте, что RabbitMQ запущен:**
   ```powershell
   .\vss-control.ps1 status
   ```

2. **Проверьте подключение:**
   ```powershell
   docker ps | findstr rabbitmq
   ```

3. **Если запускаете локально, используйте localhost:**
   ```javascript
   const RABBITMQ_URL = 'amqp://vss-admin:vss_rabbit_pass@localhost:5672/vss';
   ```

4. **Для Docker окружения:**
   ```javascript
   const RABBITMQ_URL = 'amqp://vss-admin:vss_rabbit_pass@rabbitmq:5672/vss';
   ```

### Проблема 4: Dead Letter Queue

**Симптом:** Сообщения попадают в Dead Letter Exchange.

**Причины:**
- Consumer отклонил сообщение с `nack(..., false, false)`
- Истек TTL сообщения
- Очередь переполнена (превышен max-length)

**Решение:**

1. **Проверьте Dead Letter сообщения:**
   - Management UI → Queues → vss.events
   - Routing key: `command.failed` или `gacs.failed`

2. **Анализируйте причину:**
   ```javascript
   // Логируйте перед nack
   console.error('[DCI] Сообщение отклонено:', msg.content.toString());
   channel.nack(msg, false, false);
   ```

3. **Создайте consumer для Dead Letter очереди:**
   ```javascript
   // Обработка неудачных сообщений
   channel.consume('vss.events', async (msg) => {
       if (msg.fields.routingKey === 'command.failed') {
           const failedCommand = JSON.parse(msg.content.toString());
           console.error('[DCI] Неудачная команда:', failedCommand);
           
           // Логируем в БД для анализа
           await pool.query(
               'INSERT INTO failed_commands (command_type, data, error) VALUES ($1, $2, $3)',
               [failedCommand.command, JSON.stringify(failedCommand), 'Processing failed']
           );
           
           channel.ack(msg);
       }
   });
   ```

### Проблема 5: Медленная обработка сообщений

**Симптом:** Сообщения обрабатываются очень медленно.

**Решения:**

1. **Увеличьте количество consumers:**
   ```javascript
   // Запустите несколько consumers
   for (let i = 0; i < 5; i++) {
       channel.consume('vss.autodial.leads', handleLead, { noAck: false });
   }
   ```

2. **Используйте prefetch для ограничения загрузки:**
   ```javascript
   // Обрабатывать не более 10 сообщений одновременно
   channel.prefetch(10);
   
   channel.consume('vss.autodial.leads', handleLead, { noAck: false });
   ```

3. **Оптимизируйте обработку:**
   ```javascript
   channel.consume('vss.call.events', async (msg) => {
       // Обрабатываем быстро, тяжелые операции делаем асинхронно
       const data = JSON.parse(msg.content.toString());
       channel.ack(msg);  // Сразу подтверждаем
       
       // Тяжелая обработка в фоне
       processHeavyTask(data).catch(console.error);
   });
   ```

---

## 📖 Дополнительные ресурсы

### Полезные команды Docker

```powershell
# Логи RabbitMQ
docker logs vss-rabbitmq -f

# Перезапуск RabbitMQ
docker restart vss-rabbitmq

# Зайти в контейнер RabbitMQ
docker exec -it vss-rabbitmq sh

# Проверить очереди через CLI
docker exec vss-rabbitmq rabbitmqctl list_queues -p /vss

# Проверить exchanges
docker exec vss-rabbitmq rabbitmqctl list_exchanges -p /vss

# Проверить bindings
docker exec vss-rabbitmq rabbitmqctl list_bindings -p /vss
```

### REST API RabbitMQ

```javascript
// Получить список очередей
const getQueues = async () => {
    const response = await fetch('http://localhost:15672/api/queues/%2Fvss', {
        headers: {
            'Authorization': 'Basic ' + btoa('vss-admin:vss_rabbit_pass')
        }
    });
    return await response.json();
};

// Опубликовать сообщение через API
const publishViaAPI = async (exchange, routingKey, payload) => {
    const response = await fetch(`http://localhost:15672/api/exchanges/%2Fvss/${exchange}/publish`, {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + btoa('vss-admin:vss_rabbit_pass'),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            routing_key: routingKey,
            payload: JSON.stringify(payload),
            properties: {
                delivery_mode: 2  // persistent
            }
        })
    });
    return await response.json();
};
```

### Тестирование RabbitMQ

```javascript
// test-rabbitmq.js
const amqp = require('amqplib');

async function testRabbitMQ() {
    try {
        // Подключение
        const connection = await amqp.connect('amqp://vss-admin:vss_rabbit_pass@localhost:5672/vss');
        const channel = await connection.createChannel();
        
        console.log('✅ Подключение успешно');
        
        // Проверяем exchanges
        await channel.checkExchange('vss.events');
        console.log('✅ Exchange vss.events существует');
        
        await channel.checkExchange('vss.commands');
        console.log('✅ Exchange vss.commands существует');
        
        // Проверяем queues
        await channel.checkQueue('vss.call.events');
        console.log('✅ Queue vss.call.events существует');
        
        // Тестовая публикация
        const testData = {
            event: 'test',
            timestamp: new Date().toISOString(),
            message: 'Тестовое сообщение'
        };
        
        channel.publish('vss.events', 'system.alert',
            Buffer.from(JSON.stringify(testData)),
            { persistent: true }
        );
        
        console.log('✅ Тестовое сообщение опубликовано');
        
        await connection.close();
        console.log('\n🎉 Все проверки пройдены!');
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    }
}

testRabbitMQ();
```

---

## 🎓 Заключение

### Основные правила работы с RabbitMQ в VSS:

1. **Всегда используйте правильный exchange:**
   - `vss.events` - для событий
   - `vss.commands` - для команд

2. **Правильные routing keys:**
   - `call.*` - события звонков
   - `slot.*` - события слотов
   - `autodial.lead` - автодозвон
   - `gacs.execute` - GUI автоматизация

3. **Всегда подтверждайте обработку:**
   ```javascript
   channel.ack(msg);  // Успешно
   channel.nack(msg, false, true);  // Ошибка, вернуть в очередь
   ```

4. **Используйте persistent сообщения:**
   ```javascript
   channel.publish(exchange, key, data, { persistent: true });
   ```

5. **Логируйте все действия:**
   ```javascript
   console.log('[SERVICE] 📤 Опубликовано:', routingKey);
   console.log('[SERVICE] 📥 Получено:', msg.content.toString());
   ```

### Архитектурные принципы:

- **OTTB** - публикует события звонков и слотов
- **DCI** - обрабатывает команды (автодозвон, GACS)
- **WORKSPACE** - транслирует события клиентам через WebSocket
- **POINT** - публикует события безопасности

---

**Версия:** 1.0  
**Дата:** 2025-01-XX  
**Автор:** VSS Engineering Team

**Контакты для вопросов:**
- RabbitMQ Management UI: http://localhost:15672
- Документация проекта: http://localhost:3100

🎉 **Удачи в работе с RabbitMQ!**

