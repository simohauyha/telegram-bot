// backend/src/bot/index.js
const TelegramBot = require('node-telegram-bot-api');
const registerCommands = require('./commands');
const registerCallbacks = require('./callbacks');

/**
 * Инициализирует и запускает Telegram-бота, регистрирует команды и колбэки.
 * @returns {TelegramBot|null} Экземпляр бота или null, если токен не установлен.
 */
function initializeBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
        console.error('🚫 КРИТИЧЕСКАЯ ОШИБКА: TELEGRAM_BOT_TOKEN не установлен в .env. Бот не будет запущен.');
        return null; // Возвращаем null, чтобы главный index.js мог это обработать
    }

    // Включаем режим polling для получения обновлений от Telegram API
    const bot = new TelegramBot(token, { polling: true });

    // Регистрируем все команды
    registerCommands(bot);
    // Регистрируем все обработчики колбэков
    registerCallbacks(bot);

    return bot;
}

module.exports = initializeBot;