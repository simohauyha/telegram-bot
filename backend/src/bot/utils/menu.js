// backend/src/bot/utils/menu.js
async function sendMainMenu(bot, chatId, text = 'Выберите опцию из меню.') {
    await bot.sendMessage(chatId, text, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Подключение', callback_data: 'connect' }],
                [{ text: 'Тарифы', callback_data: 'tariffs' }],
                [{ text: '⭐ Мои подписки', callback_data: 'my_subscriptions' }],
                [{ text: 'Промокод', callback_data: 'promocode' }],
                [{ text: 'Инструкция', callback_data: 'instruction' }],
                [{ text: 'Поддержка', callback_data: 'support' }]
            ]
        }
    });
}

module.exports = {
    sendMainMenu
};