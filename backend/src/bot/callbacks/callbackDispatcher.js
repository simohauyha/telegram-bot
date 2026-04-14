// backend/src/bot/callbacks/callbackDispatcher.js
const mainMenuCallbackHandlers = require('./mainMenuCallbacks');
const tariffCallbackHandlers = require('./tariffsCallbacks');
const subscriptionCallbackHandlers = require('./subscriptionHandlers');
const { sendMainMenu } = require('../utils/menu');
const { resetUserState, getUserState, states } = require('../utils/conversationStates'); // <-- ИЗМЕНЕНО: Добавлен getUserState, states
const { User, Subscription} = require('../../../models'); // Прямой импорт моделей

/**
 * Словарь для хранения обработчиков статических колбэков.
 * Ключ - это `callback_data` (строгое совпадение).
 * Значение - это функция-обработчик.
 */
const staticHandlers = {
    'connect': mainMenuCallbackHandlers.connectHandler,
    'promocode': mainMenuCallbackHandlers.promocodeHandler,
    'instruction': mainMenuCallbackHandlers.instructionHandler,
    'support': mainMenuCallbackHandlers.supportHandler,
    'tariffs': tariffCallbackHandlers.tariffsListHandler,
    'my_subscriptions': subscriptionCallbackHandlers.mySubscriptionsHandler,
    'main_menu': async (bot, chatId, callbackQueryId, data, callbackQuery) => {
        try { 
            await bot.answerCallbackQuery(callbackQueryId, { text: 'Возвращаюсь в главное меню.' });
        } catch (err) { 
            console.warn(`[CALLBACK_ERROR] Ошибка ответа на callbackQuery ID ${callbackQueryId} (main_menu): ${err.message}`);
        }
        await sendMainMenu(bot, chatId, 'Возвращаюсь в главное меню.');
        resetUserState(chatId); // <-- ИЗМЕНЕНО: Полный сброс состояния
        console.log(`[STATE] Пользователь ${chatId} все состояния сброшены.`);
    },
};

/**
 * Функция для обработки колбэка отмены покупки.
 * Вынесена отдельно для чистоты основного диспетчера.
 */
async function handleCancelPurchase(bot, callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const callbackQueryId = callbackQuery.id;
    const telegram_id = callbackQuery.from.id;
    const subscriptionIdToCancel = parseInt(data.split('_')[2], 10);

    try {
        await bot.answerCallbackQuery(callbackQueryId, { text: 'Отмена покупки.' });
    } catch (err) { 
        console.warn(`[CALLBACK_ERROR] Ошибка ответа на callbackQuery ID ${callbackQueryId} (отмена): ${err.message}`);
      
    }

    try {
        const user = await User.findOne({ where: { telegram_id } });
        if (!user) {
            console.warn(`⚠️ Попытка отмены подписки от неизвестного пользователя ${telegram_id}`);
            await bot.sendMessage(chatId, 'Не удалось найти ваш профиль. Пожалуйста, начните с команды /start.');
            await sendMainMenu(bot, chatId);
            resetUserState(chatId); // <-- ИЗМЕНЕНО: Полный сброс
            return;
        }

        const subscriptionToCancel = await Subscription.findByPk(subscriptionIdToCancel);

        if (!subscriptionToCancel || subscriptionToCancel.user_id !== user.id) {
            console.warn(`⚠️ Попытка отмены чужой или несуществующей подписки ${subscriptionIdToCancel} пользователем ${telegram_id}`);
            await bot.sendMessage(chatId, 'Не удалось найти эту подписку или она не принадлежит вам.');
            await sendMainMenu(bot, chatId);
            return;
        }

        if (subscriptionToCancel.is_paid || subscriptionToCancel.is_active) {
            console.warn(`⚠️ Попытка отмены оплаченной/активной подписки ${subscriptionIdToCancel} пользователем ${telegram_id}`);
            await bot.sendMessage(chatId, 'Эту подписку нельзя отменить, так как она уже оплачена или активна.');
            await sendMainMenu(bot, chatId);
            return;
        }

        // Если все проверки пройдены, удаляем подписку
        await subscriptionToCancel.destroy();
        console.log(`[CLEANUP] Явная отмена. Удалена подписка ID ${subscriptionIdToCancel}.`);
        // <-- ДОБАВЛЕНО: Очищаем связанную активацию промокода, если она не привязана к другой подписке
        const userPromocodeActivation = await UserPromocode.findOne({
            where: { applied_to_subscription_id: subscriptionIdToCancel, is_applied: false }
        });
        if (userPromocodeActivation) {
            console.log(`[CLEANUP] Удаляю неиспользованную активацию промокода ID ${userPromocodeActivation.id} связанную с отмененной подпиской.`);
            await userPromocodeActivation.destroy();
        }
        await bot.sendMessage(chatId, 'Неоплаченная подписка удалена. Возвращаюсь в главное меню.');
        await sendMainMenu(bot, chatId);
        resetUserState(chatId); // <-- ИЗМЕНЕНО: Полный сброс после успешной отмены

    } catch (error) {
        console.error(`❌ Ошибка при отмене подписки ${subscriptionIdToCancel} для пользователя ${telegram_id}:`, error);
        await bot.sendMessage(chatId, 'Произошла ошибка при отмене подписки. Пожалуйста, попробуйте позже.');
        await sendMainMenu(bot, chatId);
        resetUserState(chatId); // <-- ИЗМЕНЕНО: Полный сброс в случае ошибки
    }
}


/**
 * Централизованный диспетчер колбэков.
 * Определяет, какой обработчик вызвать на основе callback_data.
 * @param {TelegramBot} bot - Экземпляр Telegram-бота.
 * @param {Object} callbackQuery - Объект callbackQuery от Telegram.
 */
const dispatchCallback = async (bot, callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const callbackQueryId = callbackQuery.id;
    const telegram_id = callbackQuery.from.id;

    console.log(`➡️ Получен callback_query: ${data} от пользователя ${chatId} (Telegram ID: ${telegram_id})`);
    // 1. Попытка обработать статические колбэки
    const staticHandler = staticHandlers[data]; // Используем объект вместо Map для простоты
    if (staticHandler) {
        await staticHandler(bot, chatId, callbackQueryId, data, callbackQuery);
        return;
    }

    // 2. Обработка динамических колбэков по префиксу
    if (data.startsWith('buy_tariff_')) {
        const tariffId = parseInt(data.split('_')[2], 10);
        console.log(`[DISPATCHER] Обнаружен колбэк 'buy_tariff_'. Вызываю buyTariffHandler для тарифа ID: ${tariffId}.`);
        await tariffCallbackHandlers.buyTariffHandler(bot, chatId, callbackQueryId, tariffId, callbackQuery);
        return;
    }

    if (data.startsWith('check_payment_')) {
        await subscriptionCallbackHandlers.checkPaymentAndActivateHandler(bot, chatId, callbackQueryId, data, callbackQuery);
        return;
    }

    if (data.startsWith('get_key_')) {
        await subscriptionCallbackHandlers.getKeyHandler(bot, chatId, callbackQueryId, data, callbackQuery);
        return;
    }

    if (data.startsWith('cancel_purchase_')) {
        await handleCancelPurchase(bot, callbackQuery); // Вызываем выделенный обработчик отмены
        return;
    }

    // 3. Если ничего не подошло - неизвестная команда
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Неизвестная команда. Пожалуйста, выберите опцию из меню.', show_alert: true });
    await sendMainMenu(bot, chatId, 'Я не понял вашу команду. Пожалуйста, выберите что-то из списка.');
    console.warn(`⚠️ Неизвестный callback_query: ${data} от пользователя ${chatId}`);
    resetUserState(chatId); // <-- ИЗМЕНЕНО: Полный сброс в случае неизвестной команды
};

module.exports = dispatchCallback;