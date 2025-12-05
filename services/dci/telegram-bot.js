const TelegramBot = require('node-telegram-bot-api');

class TelegramBotManager {
    constructor(pool, rabbitmqChannel) {
        this.pool = pool;
        this.rabbitmqChannel = rabbitmqChannel;
        this.bot = null;
        this.isConnected = false;
        this.chatId = null;
        this.botToken = null;
    }

    /**
     * Подключение к Telegram боту
     * @param {string} botToken - Токен бота от @BotFather
     * @param {number} chatId - ID чата для отправки сообщений (опционально)
     * @returns {Promise<Object>} Результат подключения
     */
    async connect(botToken, chatId = null) {
        try {
            if (!botToken) {
                throw new Error('Bot token is required');
            }

            // Если бот уже подключен, отключаем его
            if (this.bot) {
                await this.disconnect();
            }

            // Создаем экземпляр бота
            this.bot = new TelegramBot(botToken, { polling: true });
            this.botToken = botToken;
            this.chatId = chatId;

            // Сохраняем конфигурацию в БД
            await this.saveBotConfig(botToken, chatId);

            // Настраиваем обработчики команд
            this.setupCommandHandlers();

            // Обработчик ошибок
            this.bot.on('error', (error) => {
                console.error('[Telegram Bot] Error:', error);
                this.publishEvent('telegram.bot.error', { error: error.message });
            });

            // Обработчик успешного подключения
            this.bot.on('polling_error', (error) => {
                console.error('[Telegram Bot] Polling error:', error);
                this.publishEvent('telegram.bot.polling_error', { error: error.message });
            });

            // Получаем информацию о боте
            let botInfo;
            try {
                botInfo = await this.bot.getMe();
            } catch (getMeError) {
                // Если getMe не удался, бот все равно может работать
                console.warn('[Telegram Bot] Warning: getMe failed, but bot may still work:', getMeError.message);
                // Пробуем использовать токен для получения информации
                const tokenParts = botToken.split(':');
                if (tokenParts.length === 2) {
                    botInfo = { id: tokenParts[0], username: 'unknown', first_name: 'Telegram Bot' };
                } else {
                    throw new Error(`Invalid bot token format. Error: ${getMeError.message}`);
                }
            }
            
            this.isConnected = true;

            console.log(`[Telegram Bot] ✅ Подключен: @${botInfo.username} (${botInfo.first_name || botInfo.id})`);

            // Публикуем событие подключения
            this.publishEvent('telegram.bot.connected', {
                bot_username: botInfo.username,
                bot_id: botInfo.id,
                chat_id: chatId
            });

            return {
                success: true,
                bot_username: botInfo.username,
                bot_id: botInfo.id,
                chat_id: chatId,
                message: `Бот @${botInfo.username || botInfo.id} успешно подключен`
            };
        } catch (error) {
            console.error('[Telegram Bot] Connection error:', error);
            this.isConnected = false;
            // Очищаем бота при ошибке
            if (this.bot) {
                try {
                    await this.bot.stopPolling();
                } catch (e) {
                    // Игнорируем ошибки при остановке
                }
                this.bot = null;
            }
            // Более информативное сообщение об ошибке
            const errorMessage = error.response?.body?.description || error.message || 'Unknown error';
            throw new Error(`Failed to connect to Telegram bot: ${errorMessage}`);
        }
    }

    /**
     * Отключение от Telegram бота
     */
    async disconnect() {
        try {
            if (this.bot) {
                await this.bot.stopPolling();
                this.bot = null;
                this.isConnected = false;
                this.botToken = null;
                this.chatId = null;

                // Удаляем конфигурацию из БД
                await this.deleteBotConfig();

                console.log('[Telegram Bot] Отключен');
                this.publishEvent('telegram.bot.disconnected', {});

                return { success: true, message: 'Бот отключен' };
            }
            return { success: false, message: 'Бот не был подключен' };
        } catch (error) {
            console.error('[Telegram Bot] Disconnect error:', error);
            throw error;
        }
    }

    /**
     * Отправка сообщения в чат
     * @param {string} message - Текст сообщения
     * @param {number} chatId - ID чата (если не указан, используется сохраненный)
     * @param {Object} options - Дополнительные опции (parse_mode, reply_markup и т.д.)
     */
    async sendMessage(message, chatId = null, options = {}) {
        try {
            if (!this.isConnected || !this.bot) {
                throw new Error('Bot is not connected');
            }

            const targetChatId = chatId || this.chatId;
            if (!targetChatId) {
                throw new Error('Chat ID is required');
            }

            const result = await this.bot.sendMessage(targetChatId, message, options);
            
            // Публикуем событие отправки сообщения
            this.publishEvent('telegram.message.sent', {
                chat_id: targetChatId,
                message_id: result.message_id
            });

            return result;
        } catch (error) {
            console.error('[Telegram Bot] Send message error:', error);
            throw error;
        }
    }

    /**
     * Получение статуса подключения
     */
    getStatus() {
        return {
            is_connected: this.isConnected,
            bot_token: this.botToken ? '***' + this.botToken.slice(-4) : null,
            chat_id: this.chatId,
            has_bot: !!this.bot
        };
    }

    /**
     * Настройка обработчиков команд бота
     */
    setupCommandHandlers() {
        if (!this.bot) return;

        // Команда /start
        this.bot.onText(/\/start/, async (msg) => {
            const chatId = msg.chat.id;
            const username = msg.from.username || msg.from.first_name;

            // Сохраняем chat_id если он не был указан
            if (!this.chatId) {
                this.chatId = chatId;
                await this.updateChatId(chatId);
            }

            await this.bot.sendMessage(chatId, 
                `👋 Привет, ${username}!\n\n` +
                `Я бот для управления VSS DCI системой.\n\n` +
                `Доступные команды:\n` +
                `/status - Статус системы\n` +
                `/help - Справка\n` +
                `/logs - Последние логи\n` +
                `/pipelines - Список пайплайнов`
            );

            this.publishEvent('telegram.command.start', { chat_id: chatId, username });
        });

        // Команда /status
        this.bot.onText(/\/status/, async (msg) => {
            const chatId = msg.chat.id;
            try {
                let dbStatus = 'недоступна';
                let activePipelines = 0;
                let serverTime = new Date().toLocaleString('ru-RU');

                // Проверяем подключение к БД
                if (this.pool) {
                    try {
                        const dbResult = await this.pool.query('SELECT NOW() as time');
                        if (dbResult.rows && dbResult.rows.length > 0) {
                            dbStatus = 'подключена';
                            serverTime = new Date(dbResult.rows[0].time).toLocaleString('ru-RU');
                        }

                        // Получаем количество активных пайплайнов (если таблица существует)
                        try {
                            const pipelinesResult = await this.pool.query(
                                "SELECT COUNT(*) as count FROM ci_pipelines WHERE status = 'running'"
                            );
                            if (pipelinesResult.rows && pipelinesResult.rows.length > 0) {
                                activePipelines = parseInt(pipelinesResult.rows[0].count) || 0;
                            }
                        } catch (pipelinesError) {
                            // Таблица может не существовать - это нормально
                            console.warn('[Telegram Bot] ci_pipelines table not found:', pipelinesError.message);
                        }
                    } catch (dbError) {
                        console.error('[Telegram Bot] Database query error:', dbError.message);
                        dbStatus = `ошибка: ${dbError.message.substring(0, 30)}...`;
                    }
                } else {
                    dbStatus = 'не инициализирована';
                }

                const statusMessage = 
                    `📊 *Статус VSS DCI*\n\n` +
                    `✅ База данных: ${dbStatus}\n` +
                    `🔄 Активных пайплайнов: ${activePipelines}\n` +
                    `⏰ Время сервера: ${serverTime}\n` +
                    `🤖 Бот: ${this.isConnected ? 'подключен' : 'отключен'}\n` +
                    `📡 RabbitMQ: ${this.rabbitmqChannel ? 'подключен' : 'не подключен'}`;

                await this.bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
                this.publishEvent('telegram.command.status', { chat_id: chatId });
            } catch (error) {
                console.error('[Telegram Bot] Error in /status command:', error);
                const errorMessage = error.message || 'Неизвестная ошибка';
                await this.bot.sendMessage(chatId, `❌ Ошибка получения статуса:\n\`${errorMessage}\``, { parse_mode: 'Markdown' });
            }
        });

        // Команда /help
        this.bot.onText(/\/help/, async (msg) => {
            const chatId = msg.chat.id;
            const helpMessage = 
                `📖 *Справка по командам VSS DCI*\n\n` +
                `*Основные:*\n` +
                `/start - Начать работу с ботом\n` +
                `/status - Статус системы DCI\n` +
                `/health - Детальная проверка здоровья\n` +
                `/services - Статус всех сервисов VSS\n\n` +
                `*Логи и мониторинг:*\n` +
                `/logs [N] - Последние N логов (по умолчанию 10)\n` +
                `/errors [N] - Последние ошибки (по умолчанию 5)\n` +
                `/warnings [N] - Последние предупреждения\n\n` +
                `*Пайплайны:*\n` +
                `/pipelines - Список пайплайнов\n` +
                `/pipeline <id> - Детали пайплайна\n` +
                `/run <id> - Запустить пайплайн\n` +
                `/stop <id> - Остановить пайплайн\n\n` +
                `*Слоты:*\n` +
                `/slots - Список слотов\n` +
                `/slot <id> - Детали слота\n\n` +
                `*Инфраструктура:*\n` +
                `/rabbitmq - Статус RabbitMQ\n\n` +
                `/help - Эта справка`;

            await this.bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
            this.publishEvent('telegram.command.help', { chat_id: chatId });
        });

        // Команда /logs
        this.bot.onText(/\/logs(?:\s+(\d+))?/, async (msg, match) => {
            const chatId = msg.chat.id;
            const limit = match[1] ? parseInt(match[1]) : 10;

            try {
                const result = await this.pool.query(
                    'SELECT module, severity, message, timestamp FROM events_log ORDER BY timestamp DESC LIMIT $1',
                    [limit]
                );

                if (result.rows.length === 0) {
                    await this.bot.sendMessage(chatId, '📝 Логи отсутствуют');
                    return;
                }

                let logsMessage = `📝 Последние ${result.rows.length} логов:\n\n`;
                result.rows.forEach((log, index) => {
                    const emoji = log.severity === 'error' ? '❌' : log.severity === 'warning' ? '⚠️' : 'ℹ️';
                    logsMessage += `${emoji} [${log.module}] ${log.message}\n`;
                    logsMessage += `   ${new Date(log.timestamp).toLocaleString('ru-RU')}\n\n`;
                });

                // Telegram ограничивает длину сообщения 4096 символов
                if (logsMessage.length > 4000) {
                    logsMessage = logsMessage.substring(0, 4000) + '\n... (сообщение обрезано)';
                }

                await this.bot.sendMessage(chatId, logsMessage);
                this.publishEvent('telegram.command.logs', { chat_id: chatId, limit });
            } catch (error) {
                await this.bot.sendMessage(chatId, `❌ Ошибка получения логов: ${error.message}`);
            }
        });

        // Команда /pipelines
        this.bot.onText(/\/pipelines/, async (msg) => {
            const chatId = msg.chat.id;
            try {
                const result = await this.pool.query(`
                    SELECT id, name, status, start_time, end_time
                    FROM ci_pipelines
                    ORDER BY created_at DESC
                    LIMIT 10
                `);

                if (result.rows.length === 0) {
                    await this.bot.sendMessage(chatId, '📋 Пайплайны отсутствуют');
                    return;
                }

                let pipelinesMessage = `📋 Последние пайплайны:\n\n`;
                result.rows.forEach((pipeline) => {
                    const statusEmoji = {
                        'running': '🔄',
                        'completed': '✅',
                        'failed': '❌',
                        'pending': '⏳'
                    }[pipeline.status] || '❓';

                    pipelinesMessage += `${statusEmoji} ${pipeline.name} (ID: ${pipeline.id})\n`;
                    pipelinesMessage += `   Статус: ${pipeline.status}\n`;
                    if (pipeline.start_time) {
                        pipelinesMessage += `   Начало: ${new Date(pipeline.start_time).toLocaleString('ru-RU')}\n`;
                    }
                    pipelinesMessage += '\n';
                });

                if (pipelinesMessage.length > 4000) {
                    pipelinesMessage = pipelinesMessage.substring(0, 4000) + '\n... (сообщение обрезано)';
                }

                await this.bot.sendMessage(chatId, pipelinesMessage);
                this.publishEvent('telegram.command.pipelines', { chat_id: chatId });
            } catch (error) {
                await this.bot.sendMessage(chatId, `❌ Ошибка получения пайплайнов: ${error.message}`);
            }
        });

        // Команда /errors - Последние ошибки
        this.bot.onText(/\/errors(?:\s+(\d+))?/, async (msg, match) => {
            const chatId = msg.chat.id;
            const limit = match[1] ? parseInt(match[1]) : 5;

            try {
                const result = await this.pool.query(
                    `SELECT module, severity, message, timestamp, context 
                     FROM events_log 
                     WHERE severity IN ('error', 'critical') 
                     ORDER BY timestamp DESC 
                     LIMIT $1`,
                    [limit]
                );

                if (result.rows.length === 0) {
                    await this.bot.sendMessage(chatId, '✅ Ошибок не найдено');
                    return;
                }

                let errorsMessage = `❌ *Последние ${result.rows.length} ошибок:*\n\n`;
                result.rows.forEach((log) => {
                    errorsMessage += `🔴 *[${log.module}]*\n`;
                    errorsMessage += `${log.message}\n`;
                    errorsMessage += `⏰ ${new Date(log.timestamp).toLocaleString('ru-RU')}\n\n`;
                });

                if (errorsMessage.length > 4000) {
                    errorsMessage = errorsMessage.substring(0, 4000) + '\n... (сообщение обрезано)';
                }

                await this.bot.sendMessage(chatId, errorsMessage, { parse_mode: 'Markdown' });
                this.publishEvent('telegram.command.errors', { chat_id: chatId, limit });
            } catch (error) {
                await this.bot.sendMessage(chatId, `❌ Ошибка получения ошибок: ${error.message}`);
            }
        });

        // Команда /warnings - Последние предупреждения
        this.bot.onText(/\/warnings(?:\s+(\d+))?/, async (msg, match) => {
            const chatId = msg.chat.id;
            const limit = match[1] ? parseInt(match[1]) : 10;

            try {
                const result = await this.pool.query(
                    `SELECT module, severity, message, timestamp 
                     FROM events_log 
                     WHERE severity = 'warning' 
                     ORDER BY timestamp DESC 
                     LIMIT $1`,
                    [limit]
                );

                if (result.rows.length === 0) {
                    await this.bot.sendMessage(chatId, '✅ Предупреждений не найдено');
                    return;
                }

                let warningsMessage = `⚠️ *Последние ${result.rows.length} предупреждений:*\n\n`;
                result.rows.forEach((log) => {
                    warningsMessage += `⚠️ [${log.module}] ${log.message}\n`;
                    warningsMessage += `   ${new Date(log.timestamp).toLocaleString('ru-RU')}\n\n`;
                });

                if (warningsMessage.length > 4000) {
                    warningsMessage = warningsMessage.substring(0, 4000) + '\n... (сообщение обрезано)';
                }

                await this.bot.sendMessage(chatId, warningsMessage, { parse_mode: 'Markdown' });
                this.publishEvent('telegram.command.warnings', { chat_id: chatId, limit });
            } catch (error) {
                await this.bot.sendMessage(chatId, `❌ Ошибка получения предупреждений: ${error.message}`);
            }
        });

        // Команда /pipeline <id> - Детали пайплайна
        this.bot.onText(/\/pipeline\s+(\d+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const pipelineId = parseInt(match[1]);

            try {
                const result = await this.pool.query(
                    `SELECT id, name, branch, status, start_time, end_time, log_url, created_at
                     FROM ci_pipelines 
                     WHERE id = $1`,
                    [pipelineId]
                );

                if (result.rows.length === 0) {
                    await this.bot.sendMessage(chatId, `❌ Пайплайн #${pipelineId} не найден`);
                    return;
                }

                const pipeline = result.rows[0];
                const statusEmoji = {
                    'running': '🔄',
                    'completed': '✅',
                    'failed': '❌',
                    'pending': '⏳'
                }[pipeline.status] || '❓';

                let duration = '';
                if (pipeline.start_time && pipeline.end_time) {
                    const start = new Date(pipeline.start_time);
                    const end = new Date(pipeline.end_time);
                    const diff = Math.floor((end - start) / 1000);
                    const minutes = Math.floor(diff / 60);
                    const seconds = diff % 60;
                    duration = `${minutes}м ${seconds}с`;
                }

                const pipelineMessage = 
                    `${statusEmoji} *Пайплайн #${pipeline.id}*\n\n` +
                    `📝 Название: ${pipeline.name}\n` +
                    `🌿 Ветка: ${pipeline.branch || 'N/A'}\n` +
                    `📊 Статус: ${pipeline.status}\n` +
                    (pipeline.start_time ? `▶️ Начало: ${new Date(pipeline.start_time).toLocaleString('ru-RU')}\n` : '') +
                    (pipeline.end_time ? `⏹️ Конец: ${new Date(pipeline.end_time).toLocaleString('ru-RU')}\n` : '') +
                    (duration ? `⏱️ Длительность: ${duration}\n` : '') +
                    (pipeline.log_url ? `📄 Логи: ${pipeline.log_url}\n` : '') +
                    `📅 Создан: ${new Date(pipeline.created_at).toLocaleString('ru-RU')}`;

                await this.bot.sendMessage(chatId, pipelineMessage, { parse_mode: 'Markdown' });
                this.publishEvent('telegram.command.pipeline', { chat_id: chatId, pipeline_id: pipelineId });
            } catch (error) {
                await this.bot.sendMessage(chatId, `❌ Ошибка получения пайплайна: ${error.message}`);
            }
        });

        // Команда /run <id> - Запустить пайплайн
        this.bot.onText(/\/run\s+(\d+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const pipelineId = parseInt(match[1]);

            try {
                await this.pool.query(
                    `UPDATE ci_pipelines 
                     SET status = $1, start_time = NOW() 
                     WHERE id = $2`,
                    ['running', pipelineId]
                );

                await this.bot.sendMessage(chatId, `🔄 Пайплайн #${pipelineId} запущен`, { parse_mode: 'Markdown' });
                this.publishEvent('telegram.command.run', { chat_id: chatId, pipeline_id: pipelineId });
            } catch (error) {
                await this.bot.sendMessage(chatId, `❌ Ошибка запуска пайплайна: ${error.message}`);
            }
        });

        // Команда /stop <id> - Остановить пайплайн
        this.bot.onText(/\/stop\s+(\d+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const pipelineId = parseInt(match[1]);

            try {
                await this.pool.query(
                    `UPDATE ci_pipelines 
                     SET status = $1, end_time = NOW() 
                     WHERE id = $2`,
                    ['failed', pipelineId]
                );

                await this.bot.sendMessage(chatId, `⏹️ Пайплайн #${pipelineId} остановлен`, { parse_mode: 'Markdown' });
                this.publishEvent('telegram.command.stop', { chat_id: chatId, pipeline_id: pipelineId });
            } catch (error) {
                await this.bot.sendMessage(chatId, `❌ Ошибка остановки пайплайна: ${error.message}`);
            }
        });

        // Команда /slots - Список слотов
        this.bot.onText(/\/slots/, async (msg) => {
            const chatId = msg.chat.id;
            try {
                const result = await this.pool.query(
                    `SELECT id, device_type, status, created_at 
                     FROM slots 
                     ORDER BY created_at DESC 
                     LIMIT 20`
                );

                if (result.rows.length === 0) {
                    await this.bot.sendMessage(chatId, '📦 Слоты отсутствуют');
                    return;
                }

                const statusCounts = {};
                result.rows.forEach(slot => {
                    statusCounts[slot.status] = (statusCounts[slot.status] || 0) + 1;
                });

                let slotsMessage = `📦 *Слоты VSS DCI*\n\n`;
                slotsMessage += `Всего: ${result.rows.length}\n`;
                Object.entries(statusCounts).forEach(([status, count]) => {
                    const emoji = status === 'free' ? '🟢' : status === 'busy' ? '🔴' : '🟡';
                    slotsMessage += `${emoji} ${status}: ${count}\n`;
                });
                slotsMessage += `\n*Последние слоты:*\n\n`;

                result.rows.slice(0, 10).forEach((slot) => {
                    const statusEmoji = slot.status === 'free' ? '🟢' : slot.status === 'busy' ? '🔴' : '🟡';
                    slotsMessage += `${statusEmoji} Слот #${slot.id} (${slot.device_type || 'N/A'})\n`;
                    slotsMessage += `   Статус: ${slot.status}\n\n`;
                });

                if (slotsMessage.length > 4000) {
                    slotsMessage = slotsMessage.substring(0, 4000) + '\n... (сообщение обрезано)';
                }

                await this.bot.sendMessage(chatId, slotsMessage, { parse_mode: 'Markdown' });
                this.publishEvent('telegram.command.slots', { chat_id: chatId });
            } catch (error) {
                // Таблица slots может не существовать
                if (error.message.includes('does not exist') || error.message.includes('relation')) {
                    await this.bot.sendMessage(chatId, 'ℹ️ Таблица слотов не найдена в базе данных');
                } else {
                    await this.bot.sendMessage(chatId, `❌ Ошибка получения слотов: ${error.message}`);
                }
            }
        });

        // Команда /slot <id> - Детали слота
        this.bot.onText(/\/slot\s+(\d+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const slotId = parseInt(match[1]);

            try {
                const result = await this.pool.query(
                    `SELECT id, device_type, status, created_at, updated_at 
                     FROM slots 
                     WHERE id = $1`,
                    [slotId]
                );

                if (result.rows.length === 0) {
                    await this.bot.sendMessage(chatId, `❌ Слот #${slotId} не найден`);
                    return;
                }

                const slot = result.rows[0];
                const statusEmoji = slot.status === 'free' ? '🟢' : slot.status === 'busy' ? '🔴' : '🟡';

                const slotMessage = 
                    `${statusEmoji} *Слот #${slot.id}*\n\n` +
                    `📱 Тип устройства: ${slot.device_type || 'N/A'}\n` +
                    `📊 Статус: ${slot.status}\n` +
                    `📅 Создан: ${new Date(slot.created_at).toLocaleString('ru-RU')}\n` +
                    (slot.updated_at ? `🔄 Обновлен: ${new Date(slot.updated_at).toLocaleString('ru-RU')}` : '');

                await this.bot.sendMessage(chatId, slotMessage, { parse_mode: 'Markdown' });
                this.publishEvent('telegram.command.slot', { chat_id: chatId, slot_id: slotId });
            } catch (error) {
                if (error.message.includes('does not exist') || error.message.includes('relation')) {
                    await this.bot.sendMessage(chatId, 'ℹ️ Таблица слотов не найдена в базе данных');
                } else {
                    await this.bot.sendMessage(chatId, `❌ Ошибка получения слота: ${error.message}`);
                }
            }
        });

        // Команда /health - Детальная проверка здоровья
        this.bot.onText(/\/health/, async (msg) => {
            const chatId = msg.chat.id;
            try {
                let healthMessage = `🏥 *Детальная проверка здоровья VSS DCI*\n\n`;

                // Проверка БД
                let dbHealth = '❌ Недоступна';
                try {
                    if (this.pool) {
                        const dbResult = await this.pool.query('SELECT NOW() as time, version() as version');
                        if (dbResult.rows && dbResult.rows.length > 0) {
                            const version = dbResult.rows[0].version.split(',')[0];
                            dbHealth = `✅ Подключена\n   Версия: ${version}`;
                        }
                    }
                } catch (dbError) {
                    dbHealth = `❌ Ошибка: ${dbError.message.substring(0, 40)}...`;
                }

                // Проверка RabbitMQ
                const rmqHealth = this.rabbitmqChannel ? '✅ Подключен' : '❌ Не подключен';

                // Проверка бота
                const botHealth = this.isConnected ? '✅ Подключен' : '❌ Отключен';

                // Статистика логов
                let logsStats = 'N/A';
                try {
                    if (this.pool) {
                        const errorCount = await this.pool.query(
                            "SELECT COUNT(*) as count FROM events_log WHERE severity IN ('error', 'critical') AND timestamp > NOW() - INTERVAL '24 hours'"
                        );
                        const warningCount = await this.pool.query(
                            "SELECT COUNT(*) as count FROM events_log WHERE severity = 'warning' AND timestamp > NOW() - INTERVAL '24 hours'"
                        );
                        logsStats = `Ошибок: ${errorCount.rows[0]?.count || 0}\n   Предупреждений: ${warningCount.rows[0]?.count || 0}`;
                    }
                } catch (e) {
                    logsStats = 'Недоступна';
                }

                healthMessage += 
                    `*База данных:*\n${dbHealth}\n\n` +
                    `*RabbitMQ:*\n${rmqHealth}\n\n` +
                    `*Telegram Bot:*\n${botHealth}\n\n` +
                    `*Логи (24ч):*\n${logsStats}`;

                await this.bot.sendMessage(chatId, healthMessage, { parse_mode: 'Markdown' });
                this.publishEvent('telegram.command.health', { chat_id: chatId });
            } catch (error) {
                await this.bot.sendMessage(chatId, `❌ Ошибка проверки здоровья: ${error.message}`);
            }
        });

        // Команда /rabbitmq - Статус и управление RabbitMQ
        this.bot.onText(/\/rabbitmq/, async (msg) => {
            const chatId = msg.chat.id;
            try {
                const rmqStatus = this.rabbitmqChannel ? '✅ Подключен' : '❌ Не подключен';
                
                let message = `🐰 *RabbitMQ Status*\n\n${rmqStatus}\n\n`;
                
                if (!this.rabbitmqChannel) {
                    message += `*Для запуска RabbitMQ:*\n\n`;
                    message += `1. Через Docker:\n`;
                    message += `\`docker run -d --name rabbitmq-local -p 5672:5672 -p 15672:15672 -e RABBITMQ_DEFAULT_USER=vss-admin -e RABBITMQ_DEFAULT_PASS=vss_rabbit_pass -e RABBITMQ_DEFAULT_VHOST=/vss rabbitmq:3-management\`\n\n`;
                    message += `2. Через Docker Compose:\n`;
                    message += `\`docker-compose -f docker-compose.vss-demiurge-simple.yml up -d rabbitmq\`\n\n`;
                    message += `*Management UI:* http://localhost:15672\n`;
                    message += `*User:* vss-admin\n`;
                    message += `*Pass:* vss_rabbit_pass\n\n`;
                    message += `После запуска сервис автоматически переподключится через 30 секунд.`;
                } else {
                    message += `*Каналы:* Активен\n`;
                    message += `*Exchanges:* Настроены\n`;
                    message += `*Queues:* Настроены\n\n`;
                    message += `*Management UI:* http://localhost:15672`;
                }
                
                await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                this.publishEvent('telegram.command.rabbitmq', { chat_id: chatId });
            } catch (error) {
                await this.bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
            }
        });

        // Команда /services - Статус всех сервисов VSS
        this.bot.onText(/\/services/, async (msg) => {
            const chatId = msg.chat.id;
            try {
                const services = [
                    { name: 'VSS DCI', port: 8082, url: 'http://localhost:8082/health' },
                    { name: 'VSS OTTB', port: 8083, url: 'http://localhost:8083/health' },
                    { name: 'VSS POINT', port: 8081, url: 'http://localhost:8081/health' },
                    { name: 'VSS Workspace', port: 3000, url: 'http://localhost:3000/' }
                ];

                let servicesMessage = `🔧 *Статус сервисов VSS*\n\n`;

                for (const service of services) {
                    try {
                        const http = require('http');
                        
                        await new Promise((resolve) => {
                            const req = http.get(service.url, { timeout: 2000 }, (res) => {
                                // Для Workspace корневой путь возвращает 200, для других - health endpoint
                                if (res.statusCode === 200) {
                                    servicesMessage += `✅ ${service.name} (${service.port})\n`;
                                } else if (res.statusCode === 404 && service.name === 'VSS Workspace') {
                                    // Workspace может не иметь /health, но сервис работает
                                    servicesMessage += `✅ ${service.name} (${service.port}) - работает\n`;
                                } else {
                                    servicesMessage += `⚠️ ${service.name} (${service.port}) - код ${res.statusCode}\n`;
                                }
                                resolve();
                            });
                            req.on('error', () => {
                                servicesMessage += `❌ ${service.name} (${service.port}) - недоступен\n`;
                                resolve();
                            });
                            req.on('timeout', () => {
                                req.destroy();
                                servicesMessage += `⏱️ ${service.name} (${service.port}) - таймаут\n`;
                                resolve();
                            });
                        });
                    } catch (error) {
                        servicesMessage += `❌ ${service.name} (${service.port}) - ошибка\n`;
                    }
                }

                await this.bot.sendMessage(chatId, servicesMessage, { parse_mode: 'Markdown' });
                this.publishEvent('telegram.command.services', { chat_id: chatId });
            } catch (error) {
                await this.bot.sendMessage(chatId, `❌ Ошибка проверки сервисов: ${error.message}`);
            }
        });
    }

    /**
     * Сохранение конфигурации бота в БД
     */
    async saveBotConfig(botToken, chatId) {
        try {
            // Создаем таблицу если её нет
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS telegram_bot_config (
                    id SERIAL PRIMARY KEY,
                    bot_token TEXT NOT NULL,
                    chat_id BIGINT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // Удаляем старую конфигурацию
            await this.pool.query('DELETE FROM telegram_bot_config');

            // Сохраняем новую
            await this.pool.query(
                'INSERT INTO telegram_bot_config (bot_token, chat_id) VALUES ($1, $2)',
                [botToken, chatId]
            );
        } catch (error) {
            console.error('[Telegram Bot] Error saving config:', error);
        }
    }

    /**
     * Обновление chat_id
     */
    async updateChatId(chatId) {
        try {
            await this.pool.query(
                'UPDATE telegram_bot_config SET chat_id = $1, updated_at = NOW()',
                [chatId]
            );
            this.chatId = chatId;
        } catch (error) {
            console.error('[Telegram Bot] Error updating chat_id:', error);
        }
    }

    /**
     * Удаление конфигурации бота из БД
     */
    async deleteBotConfig() {
        try {
            await this.pool.query('DELETE FROM telegram_bot_config');
        } catch (error) {
            console.error('[Telegram Bot] Error deleting config:', error);
        }
    }

    /**
     * Загрузка конфигурации из БД
     */
    async loadBotConfig() {
        try {
            const result = await this.pool.query('SELECT bot_token, chat_id FROM telegram_bot_config LIMIT 1');
            if (result.rows.length > 0) {
                return {
                    botToken: result.rows[0].bot_token,
                    chatId: result.rows[0].chat_id
                };
            }
            return null;
        } catch (error) {
            console.error('[Telegram Bot] Error loading config:', error);
            return null;
        }
    }

    /**
     * Автоматическое подключение при старте (если есть сохраненная конфигурация)
     */
    async autoConnect() {
        try {
            const config = await this.loadBotConfig();
            if (config && config.botToken) {
                console.log('[Telegram Bot] Автоматическое подключение...');
                await this.connect(config.botToken, config.chatId);
                return true;
            }
            return false;
        } catch (error) {
            console.error('[Telegram Bot] Auto-connect error:', error);
            return false;
        }
    }

    /**
     * Публикация события в RabbitMQ
     */
    publishEvent(eventType, data) {
        if (this.rabbitmqChannel) {
            try {
                this.rabbitmqChannel.publish('vss.events', 'telegram.event', Buffer.from(JSON.stringify({
                    event: eventType,
                    data: data,
                    timestamp: new Date().toISOString()
                })));
            } catch (error) {
                console.error('[Telegram Bot] Error publishing event:', error);
            }
        }
    }
}

module.exports = TelegramBotManager;

