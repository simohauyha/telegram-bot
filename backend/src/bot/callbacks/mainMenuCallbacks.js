// backend/src/bot/callbacks/mainMenuCallbacks.js
const { sendMainMenu } = require('../utils/menu');
const { setUserState, states } = require('../utils/conversationStates');
const { cleanupPendingPurchase } = require('../utils/cleanupService');

const YOUR_TELEGRAM_USERNAME = process.env.YOUR_TELEGRAM_USERNAME;

const connectHandler = async (bot, chatId, callbackQueryId, data, callbackQuery) => { 
    await cleanupPendingPurchase(chatId);
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Загружаю информацию о подключении...' });
    await bot.sendMessage(chatId, 'Здесь будет информация о подключении...');
};

const promocodeHandler = async (bot, chatId, callbackQueryId, data, callbackQuery) => { 
    await cleanupPendingPurchase(chatId);
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Готов принять ваш промокод!' });
    await bot.sendMessage(chatId, 'Пожалуйста, введите ваш промокод:');
    setUserState(chatId, states.CURRENT_STEP, states.AWAITING_PROMOCODE);
    console.log(`[STATE] Пользователь ${chatId} переведен в шаг: ${states.AWAITING_PROMOCODE}`);
};

const instructionHandler = async (bot, chatId, callbackQueryId, data, callbackQuery) => { 
    await cleanupPendingPurchase(chatId);
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Открываю инструкцию...' });
    await bot.sendMessage(chatId, 'Здесь будет пошаговая инструкция...');
};

const supportHandler = async (bot, chatId, callbackQueryId, data, callbackQuery) => { 
    await cleanupPendingPurchase(chatId);
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Связываю с поддержкой...' });
    await bot.sendMessage(chatId, 'Для поддержки нажмите кнопку ниже:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Написать в поддержку', url: `tg://resolve?domain=${YOUR_TELEGRAM_USERNAME}` }]
            ]
        }
    });
};

module.exports = {
    connectHandler,
    promocodeHandler,
    instructionHandler,
    supportHandler,
};