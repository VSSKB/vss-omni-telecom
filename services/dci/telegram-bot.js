pconst TelegramBot = require('node-telegram-bot-api');

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
                // Получаем статус системы из БД
                const dbStatus = await this.pool.query('SELECT NOW() as time');
                const activePipelines = await this.pool.query(
                    "SELECT COUNT(*) as count FROM ci_pipelines WHERE status = 'running'"
                );

                const statusMessage = 
                    `📊 Статус VSS DCI:\n\n` +
                    `✅ База данных: подключена\n` +
                    `🔄 Активных пайплайнов: ${activePipelines.rows[0].count}\n` +
                    `⏰ Время сервера: ${dbStatus.rows[0].time}\n` +
                    `🤖 Бот: ${this.isConnected ? 'подключен' : 'отключен'}`;

                await this.bot.sendMessage(chatId, statusMessage);
                this.publishEvent('telegram.command.status', { chat_id: chatId });
            } catch (error) {
                await this.bot.sendMessage(chatId, `❌ Ошибка получения статуса: ${error.message}`);
            }
        });

        // Команда /help
        this.bot.onText(/\/help/, async (msg) => {
            const chatId = msg.chat.id;
            const helpMessage = 
                `📖 Справка по командам:\n\n` +
                `/start - Начать работу с ботом\n` +
                `/status - Статус системы DCI\n` +
                `/logs [N] - Последние N логов (по умолчанию 10)\n` +
                `/pipelines - Список активных пайплайнов\n` +
                `/help - Эта справка`;

            await this.bot.sendMessage(chatId, helpMessage);
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

