// backend/src/bot/commands/start.js
const userService = require('../../services/userService');
const { sendMainMenu } = require('../utils/menu');
const { setUserState, resetUserState } = require('../utils/conversationStates');
const { cleanupPendingPurchase } = require('../utils/cleanupService');

module.exports = (bot) => {
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const { id: telegram_id, first_name, last_name, username } = msg.from;
        await cleanupPendingPurchase(chatId);
        try {
            // <-- ИЗМЕНЕНО: Передаем один объект userData
            const [user, created] = await userService.findOrCreateUser({
                telegram_id: telegram_id, // Ключ для поиска
                first_name: first_name,
                last_name: last_name,
                username: username
            });

            if (created) {
                console.log(`New user registered: ${username || first_name} (Telegram ID: ${telegram_id})`);
            } else {
                console.log(`User ${username || first_name} (Telegram ID: ${telegram_id}) already exists.`);
            }

            setUserState(chatId, null);
            console.log(`[STATE] Пользователь ${chatId} состояние сброшено.`);
            await sendMainMenu(bot, chatId, 'Добро пожаловать в наш VPN-бот! Выберите опцию из меню.');

        } catch (error) {
            console.error(`Error handling /start command for user ${telegram_id}:`, error);
            await bot.sendMessage(chatId, 'Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.');
        }
    });
};