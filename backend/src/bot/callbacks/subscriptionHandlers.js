// backend/src/bot/callbacks/subscriptionHandlers.js
const subscriptionService = require('../../services/subscriptionService');
const tariffService = require('../../services/tariffService');
const hiddifyService = require('../../services/hiddifyService');
const paymentService = require('../../services/paymentService');
const { sendMainMenu } = require('../utils/menu');
// <-- ИМПОРТИРУЕМ ВСЕ НЕОБХОДИМЫЕ МОДЕЛИ И ОБЪЕКТ Sequelize -->
const { User, Promocode, UserPromocode, Sequelize } = require('../../../models');
// <-- ИМПОРТИРУЕМ СЕРВИС ПРОМОКОДОВ И API СОСТОЯНИЙ (для сброса) -->
const promocodeService = require('../../services/promocodeService');
const { resetUserState } = require('../utils/conversationStates');
const { cleanupPendingPurchase } = require('../utils/cleanupService');

/**
 * Обработчик для проверки платежа и активации подписки.
 * @param {TelegramBot} bot - Экземпляр бота.
 * @param {number} chatId - ID чата.
 * @param {string} callbackQueryId - ID callback запроса.
 * @param {string} callbackData - Callback data.
 * @param {Object} callbackQuery - Объект callbackQuery.
 */
const checkPaymentAndActivateHandler = async (bot, chatId, callbackQueryId, callbackData, callbackQuery) => { // <-- ДОБАВЛЕН callbackQuery
    const subscriptionId = parseInt(callbackData.split('_')[2], 10);
    const telegram_id = callbackQuery.from.id; // <-- ИЗМЕНЕНО: получаем telegram_id напрямую
    console.log(`[CHECK_PAYMENT] Пользователь ${telegram_id} проверяет оплату для подписки ID: ${subscriptionId}.`);

    await bot.answerCallbackQuery(callbackQueryId, { text: 'Проверяю статус платежа...' });

    try {
        const user = await User.findOne({ where: { telegram_id } });
        if (!user) {
            console.warn(`[CHECK_PAYMENT] Не удалось найти профиль пользователя ${telegram_id}.`);
            await bot.sendMessage(chatId, 'Не удалось найти ваш профиль. Пожалуйста, начните с команды /start.');
            await sendMainMenu(bot, chatId);
            resetUserState(chatId); // <-- Полный сброс состояния
            return;
        }

        const subscription = await subscriptionService.getSubscriptionById(subscriptionId);
        if (!subscription || subscription.user_id !== user.id) {
            console.warn(`[CHECK_PAYMENT] Подписка ID ${subscriptionId} не найдена или не принадлежит пользователю ${telegram_id}.`);
            await bot.sendMessage(chatId, 'Не удалось найти вашу подписку. Возможно, она уже активирована или произошла ошибка.');
            await sendMainMenu(bot, chatId);
            return;
        }

        if (subscription.is_paid && subscription.is_active) {
            console.log(`[CHECK_PAYMENT] Подписка ID ${subscriptionId} уже оплачена и активна для пользователя ${telegram_id}.`);
            await bot.sendMessage(chatId, 'Ваша подписка уже оплачена и активна!');
            const tariff = await tariffService.getTariffById(subscription.tariff_id);
            const connectionLinkMessage = hiddifyService.getHiddifyConnectionLink(subscription.hiddify_key);
            await bot.sendMessage(chatId,
                `*Информация о вашей подписке:*\n` +
                `Тариф: *${tariff.name}*\n` +
                `Действует до: *${subscription.end_date.toLocaleDateString('ru-RU')}*\n\n` +
                `Вот ваш ключ:\n${connectionLinkMessage}`,
                { parse_mode: 'Markdown', disable_web_page_preview: true }
            );
            await sendMainMenu(bot, chatId, 'Что еще могу сделать?');
            resetUserState(chatId); // <-- Полный сброс состояния
            return;
        } else if (subscription.is_paid && !subscription.is_active) { // <-- ДОБАВЛЕНО
            console.warn(`[CHECK_PAYMENT] Подписка ID ${subscriptionId} оплачена, но неактивна для пользователя ${telegram_id}.`);
            await bot.sendMessage(chatId, 'Ваша подписка оплачена, но в настоящее время неактивна. Пожалуйста, свяжитесь с поддержкой.');
            await sendMainMenu(bot, chatId, 'Возвращаюсь в главное меню.');
            resetUserState(chatId); // <-- Полный сброс состояния
            return;
        }

        const paymentStatus = await paymentService.checkPaymentStatus(`sub_${subscription.id}`);
        console.log(`[CHECK_PAYMENT] Статус платежа для подписки ID ${subscriptionId}: ${paymentStatus.status}`);

        if (paymentStatus.status === 'paid') {
            const tariff = await tariffService.getTariffById(subscription.tariff_id);
            const startDate = new Date();
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + tariff.duration_days);

            await subscriptionService.updateSubscription(subscription.id, {
                is_paid: true,
                is_active: true,
                start_date: startDate,
                end_date: endDate
            });
            console.log(`[CHECK_PAYMENT] Подписка ID ${subscriptionId} успешно активирована и оплачена.`);


            await hiddifyService.activateOrUpdateHiddifySubscription(subscription.hiddify_uuid, tariff.duration_days);
            console.log(`[CHECK_PAYMENT] Hiddify API вызван для UUID ${subscription.hiddify_uuid}.`);

            // <-- ЛОГИКА ОКОНЧАТЕЛЬНОЙ ОТМЕТКИ ПРОМОКОДА -->
            if (subscription.promocode_id) { // Если к этой подписке был привязан промокод
                const userPromocodeActivation = await UserPromocode.findOne({
                    where: {
                        promocode_id: subscription.promocode_id,
                        user_id: user.id,
                        applied_to_subscription_id: subscription.id, // И привязан именно к этой подписке
                        is_applied: false // И еще не помечен как примененный
                    }
                });

                if (userPromocodeActivation) {
                    await userPromocodeActivation.update({ is_applied: true });
                    console.log(`[PAYMENT_SUCCESS] Промокод ID ${subscription.promocode_id} (активация ID ${userPromocodeActivation.id}) успешно помечен как примененный к подписке ${subscription.id}.`);
                } else {
                    console.warn(`[PAYMENT_SUCCESS] Промокод ID ${subscription.promocode_id} не найден или уже был помечен как примененный для подписки ${subscription.id}.`);
                }
            }
            // <-- КОНЕЦ ЛОГИКИ ОКОНЧАТЕЛЬНОЙ ОТМЕТКИ ПРОМОКОДА -->

            const connectionLinkMessage = hiddifyService.getHiddifyConnectionLink(subscription.hiddify_key);

            await bot.sendMessage(chatId,
                `🎉 *Поздравляем! Ваша подписка активирована!* 🎉\n\n` +
                `Тариф: *${tariff.name}*\n` +
                `Действует до: *${endDate.toLocaleDateString('ru-RU')}*\n\n` +
                `Вот ваш уникальный ключ для подключения:\n${connectionLinkMessage}`,
                { parse_mode: 'Markdown', disable_web_page_preview: true }
            );

            await sendMainMenu(bot, chatId, 'Ваш VPN готов к работе!');
            resetUserState(chatId); // <-- Полный сброс состояния
        } else {
            console.log(`[CHECK_PAYMENT] Платеж для подписки ID ${subscriptionId} еще не прошел. Статус: ${paymentStatus.status}.`);
            await bot.sendMessage(chatId, 'Платеж еще не прошел. Пожалуйста, подождите или попробуйте снова.');
            // Не сбрасываем состояние, если платеж в процессе, чтобы пользователь мог повторно нажать "Я оплатил"
        }

    } catch (error) {
        console.error(`❌ Ошибка при проверке оплаты для подписки ${subscriptionId} пользователя ${telegram_id}:`, error);
        await bot.sendMessage(chatId, 'Произошла ошибка при проверке оплаты. Пожалуйста, попробуйте позже.');
        await sendMainMenu(bot, chatId);
        resetUserState(chatId); // <-- Полный сброс состояния при ошибке
    }
};

/**
 * Обработчик для отображения списка подписок пользователя.
 * @param {TelegramBot} bot - Экземпляр бота.
 * @param {number} chatId - ID чата.
 * @param {string} callbackQueryId - ID callback запроса.
 * @param {string} data - Callback data.
 * @param {Object} callbackQuery - Объект callbackQuery.
 */
const mySubscriptionsHandler = async (bot, chatId, callbackQueryId, data, callbackQuery) => { 
    await cleanupPendingPurchase(chatId);
    const telegram_id = callbackQuery.from.id; // <-- ПОЛУЧАЕМ telegram_id напрямую
    console.log(`[MY_SUBSCRIPTIONS] Запрос списка подписок от пользователя ${telegram_id}.`);

    await bot.answerCallbackQuery(callbackQueryId, { text: 'Загружаю ваши подписки...' });

    try {
        const user = await User.findOne({ where: { telegram_id } });
        if (!user) {
            console.warn(`[MY_SUBSCRIPTIONS] Не удалось найти профиль пользователя ${telegram_id}.`);
            await bot.sendMessage(chatId, 'Не удалось найти ваш профиль. Пожалуйста, начните с команды /start.');
            await sendMainMenu(bot, chatId);
            resetUserState(chatId); // <-- Полный сброс состояния
            return;
        }

        const allSubscriptions = await subscriptionService.getUserSubscriptions(user.id); // Получаем все подписки
        // <-- НОВАЯ ЛОГИКА ФИЛЬТРАЦИИ -->
        const subscriptionsToShow = allSubscriptions.filter(sub => {
            const now = new Date();
            // Показываем:
            // 1. Активные и оплаченные (не истекшие)
            // 2. Оплаченные, но неактивные (могут быть истекшими)
            // НЕ показываем:
            // 1. Неоплаченные (is_paid: false)
            return sub.is_paid;
        });

        if (subscriptionsToShow.length === 0) { // <-- ИЗМЕНЕНО: используем отфильтрованный массив
            console.log(`[MY_SUBSCRIPTIONS] У пользователя ${telegram_id} нет оплаченных подписок для отображения.`);
            await bot.sendMessage(chatId, 'У вас пока нет активных или завершенных подписок.');
            await sendMainMenu(bot, chatId, 'Что еще могу сделать?');
            return;
        }

        let message = '📊 *Ваши подписки:*\n\n';
        const inlineKeyboard = [];

        for (const sub of subscriptionsToShow) { // <-- ИЗМЕНЕНО: итерируемся по отфильтрованному массиву
            const now = new Date();
            let statusIcon = '❓';
            let statusText = 'Неизвестно';
            let endDateText = '';
            let isExpired = false;
            let priceToDisplay = sub.tariff.price; // Исходная цена тарифа для повторной оплаты

            // Если есть promocode_id, попробуем получить скидку и отобразить её
            if (sub.promocode_id) {
                const promocode = await Promocode.findByPk(sub.promocode_id);
                if (promocode) {
                    priceToDisplay = promocodeService.applyDiscount(priceToDisplay, promocode.discount_percentage);
                }
            }


            if (sub.is_paid && sub.is_active && sub.end_date && sub.end_date >= now) {
                statusIcon = '✅';
                statusText = 'Активна';
                endDateText = ` до *${sub.end_date.toLocaleDateString('ru-RU')}*`;
            } else if (sub.is_paid && sub.is_active && sub.end_date && sub.end_date < now) {
                statusIcon = '⛔'; // <-- ИЗМЕНЕНО на иконку
                statusText = 'Завершена (срок истек)';
                endDateText = ` (истекла *${sub.end_date.toLocaleDateString('ru-RU')}*)`;
                isExpired = true;
            } else if (sub.is_paid && !sub.is_active) {
                statusIcon = '🚫';
                statusText = 'Неактивна (оплачена, но деактивирована)';
            }
            // else if (!sub.is_paid) { // <-- УДАЛЕН ЭТОТ БЛОК, т.к. неоплаченные не показываем
            //     statusIcon = '⏳';
            //     statusText = 'Ожидает оплаты';
            // }

            message += `*Тариф:* ${sub.tariff.name}\n` +
                       `*Статус:* ${statusIcon} ${statusText}${endDateText}\n`;

            if (sub.is_active && sub.hiddify_key && !isExpired) {
                message += `*Ваш ключ:* \`${sub.hiddify_key.substring(0, 30)}...\`\n`;
                inlineKeyboard.push([{ text: `🔑 Ключ для ${sub.tariff.name}`, callback_data: `get_key_${sub.id}` }]);
            }
            // else if (!sub.is_paid) { // <-- УДАЛЕН ЭТОТ БЛОК
            //     message += `*Ожидает оплаты.* Нажмите "Оплатить" ниже.\n`;
            //     const payment = await paymentService.createPaymentLink(
            //         sub.tariff.price,
            //         `Повторная оплата тарифа "${sub.tariff.name}" (подписка ${sub.id})`,
            //         `sub_${sub.id}`
            //     );
            //     if (payment && payment.paymentLink) {
            //          inlineKeyboard.push([{ text: `💳 Оплатить ${sub.tariff.name} (${sub.tariff.price} руб.)`, url: payment.paymentLink }]);
            //          inlineKeyboard.push([{ text: `✅ Я оплатил(а) (${sub.tariff.name})`, callback_data: `check_payment_${sub.id}` }]);
            //     } else {
            //          message += `Не удалось сгенерировать ссылку для повторной оплаты.\n`;
            //     }
            // }
            // Добавляем опцию продления, если подписка активна или истекла, но не деактивирована
            if (sub.is_paid && !sub.is_active && isExpired && sub.tariff && priceToDisplay) { // Продление для истекших подписок
                message += `_Срок действия истек. Вы можете продлить подписку._\n`;
                const payment = await paymentService.createPaymentLink(
                    priceToDisplay, // <-- ИСПОЛЬЗУЕМ ЦЕНУ СО СКИДКОЙ (если есть)
                    `Продление тарифа "${sub.tariff.name}" (подписка ${sub.id})`,
                    `sub_renewal_${sub.id}` // Новый тип orderId для продления
                );
                 if (payment && payment.paymentLink) {
                     inlineKeyboard.push([{ text: `💳 Продлить ${sub.tariff.name} (${priceToDisplay.toFixed(2)} руб.)`, url: payment.paymentLink }]);
                     inlineKeyboard.push([{ text: `✅ Я оплатил(а) продление (${sub.tariff.name})`, callback_data: `check_payment_renewal_${sub.id}` }]); // Новый колбэк для продления
                } else {
                     message += `Не удалось сгенерировать ссылку для продления.\n`;
                }
            }
            message += '\n'; // Пустая строка для разделения подписок
        }

        inlineKeyboard.push([{ text: '↩️ Назад в меню', callback_data: 'main_menu' }]);

        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: inlineKeyboard
            }
        });
        console.log(`[MY_SUBSCRIPTIONS] Список оплаченных подписок отправлен пользователю ${telegram_id}.`);

    } catch (error) {
        console.error(`❌ Ошибка получения подписок для пользователя ${telegram_id}:`, error);
        await bot.sendMessage(chatId, 'Произошла ошибка при загрузке ваших подписок. Пожалуйста, попробуйте позже.');
        await sendMainMenu(bot, chatId);
        resetUserState(chatId);
    }
};

/**
 * Обработчик для получения ключа активной подписки
 * @param {TelegramBot} bot - Экземпляр бота.
 * @param {number} chatId - ID чата.
 * @param {string} callbackQueryId - ID callback запроса.
 * @param {string} callbackData - Callback data.
 * @param {Object} callbackQuery - Объект callbackQuery.
 */
const getKeyHandler = async (bot, chatId, callbackQueryId, callbackData, callbackQuery) => { // <-- ДОБАВЛЕН callbackQuery
    const subscriptionId = parseInt(callbackData.split('_')[2], 10);
    const telegram_id = callbackQuery.from.id; // <-- ПОЛУЧАЕМ telegram_id напрямую
    console.log(`[GET_KEY] Запрос ключа для подписки ID ${subscriptionId} от пользователя ${telegram_id}.`);

    await bot.answerCallbackQuery(callbackQueryId, { text: 'Генерирую ваш ключ...' });
    await cleanupPendingPurchase(chatId);
    try {
        const user = await User.findOne({ where: { telegram_id } });
        if (!user) {
            console.warn(`[GET_KEY] Не удалось найти профиль пользователя ${telegram_id}.`);
            await bot.sendMessage(chatId, 'Не удалось найти ваш профиль. Пожалуйста, начните с команды /start.');
            await sendMainMenu(bot, chatId);
            resetUserState(chatId); // <-- Полный сброс состояния
            return;
        }

        const subscription = await subscriptionService.getSubscriptionById(subscriptionId);
        if (!subscription || subscription.user_id !== user.id) {
            console.warn(`[GET_KEY] Подписка ID ${subscriptionId} не найдена или не принадлежит пользователю ${telegram_id}.`);
            await bot.sendMessage(chatId, 'Не удалось найти вашу подписку.');
            await sendMainMenu(bot, chatId);
            return;
        }

        const now = new Date();
        // Проверяем, что подписка активна и не истекла
        if (subscription.is_active && subscription.is_paid && subscription.end_date >= now) {
            const connectionLinkMessage = hiddifyService.getHiddifyConnectionLink(subscription.hiddify_key);
            await bot.sendMessage(chatId,
                `*Ваш ключ для подключения:*\n\n` +
                `${connectionLinkMessage}`,
                { parse_mode: 'Markdown', disable_web_page_preview: true }
            );
            console.log(`[GET_KEY] Ключ для подписки ID ${subscriptionId} отправлен пользователю ${telegram_id}.`);
        } else {
            console.warn(`[GET_KEY] Попытка получить ключ для неактивной/истекшей подписки ID ${subscriptionId} от пользователя ${telegram_id}.`);
            await bot.sendMessage(chatId, 'Эта подписка неактивна или ее срок истек. Вы не можете получить ключ.');
        }
        await sendMainMenu(bot, chatId, 'Что еще могу сделать?');
        resetUserState(chatId); // <-- Полный сброс состояния
    } catch (error) {
        console.error(`❌ Ошибка получения ключа для подписки ${subscriptionId} пользователя ${telegram_id}:`, error);
        await bot.sendMessage(chatId, 'Произошла ошибка при получении ключа. Пожалуйста, попробуйте позже.');
        await sendMainMenu(bot, chatId);
        resetUserState(chatId); // <-- Полный сброс состояния при ошибке
    }
};

module.exports = {
    checkPaymentAndActivateHandler,
    mySubscriptionsHandler,
    getKeyHandler
};