// backend/src/bot/callbacks/index.js
const dispatchCallback = require('./callbackDispatcher'); // Импортируем новый диспетчер

module.exports = (bot) => {
    bot.on('callback_query', async (callbackQuery) => {
        await dispatchCallback(bot, callbackQuery); // Передаем весь callbackQuery
    });
};