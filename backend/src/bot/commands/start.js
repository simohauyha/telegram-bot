// backend/src/bot/commands/start.js
const userService = require('../../services/userService');
const { sendMainMenu } = require('../utils/menu');

module.exports = (bot) => {
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const { id: telegram_id, first_name, last_name, username } = msg.from;

        try {
            const [user, created] = await userService.findOrCreateUser({
                telegram_id,
                first_name,
                last_name,
                username
            });

            if (created) {
                console.log(`New user registered: ${username || first_name} (Telegram ID: ${telegram_id})`);
            } else {
                console.log(`User ${username || first_name} (Telegram ID: ${telegram_id}) already exists.`);
            }

            await sendMainMenu(bot, chatId, 'Добро пожаловать в наш VPN-бот! Выберите опцию из меню.');

        } catch (error) {
            console.error(`Error handling /start command for user ${telegram_id}:`, error);
            await bot.sendMessage(chatId, 'Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.');
        }
    });
};