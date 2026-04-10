// backend/src/bot/callbacks/subscriptionHandlers.js
const subscriptionService = require('../../services/subscriptionService');
const tariffService = require('../../services/tariffService');
const hiddifyService = require('../../services/hiddifyService');
const paymentService = require('../../services/paymentService');
const { sendMainMenu } = require('../utils/menu');
const { User } = require('../../../models');

const checkPaymentAndActivateHandler = async (bot, chatId, callbackQueryId, callbackData) => {
    const subscriptionId = parseInt(callbackData.split('_')[2], 10);
    const telegram_id = (await bot.getChat(chatId)).id;
    
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Проверяю статус платежа...' });

    try {
        const user = await User.findOne({ where: { telegram_id } });
        if (!user) {
            await bot.sendMessage(chatId, 'Не удалось найти ваш профиль. Пожалуйста, начните с команды /start.');
            await sendMainMenu(bot, chatId);
            return;
        }

        const subscription = await subscriptionService.getSubscriptionById(subscriptionId);
        if (!subscription || subscription.user_id !== user.id) {
            await bot.sendMessage(chatId, 'Не удалось найти вашу подписку. Возможно, она уже активирована или произошла ошибка.');
            await sendMainMenu(bot, chatId);
            return;
        }

        if (subscription.is_paid && subscription.is_active) {
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
            return;
        }

        const paymentStatus = await paymentService.checkPaymentStatus(`sub_${subscription.id}`);
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

            await hiddifyService.activateOrUpdateHiddifySubscription(subscription.hiddify_uuid, tariff.duration_days);

            const connectionLinkMessage = hiddifyService.getHiddifyConnectionLink(subscription.hiddify_key);

            await bot.sendMessage(chatId,
                `🎉 *Поздравляем! Ваша подписка активирована!* 🎉\n\n` +
                `Тариф: *${tariff.name}*\n` +
                `Действует до: *${endDate.toLocaleDateString('ru-RU')}*\n\n` +
                `Вот ваш уникальный ключ для подключения:\n${connectionLinkMessage}`,
                { parse_mode: 'Markdown', disable_web_page_preview: true }
            );

            await sendMainMenu(bot, chatId, 'Ваш VPN готов к работе!');

        } else {
            await bot.sendMessage(chatId, 'Платеж еще не прошел. Пожалуйста, подождите или попробуйте снова.');
        }

    } catch (error) {
        console.error(`❌ Ошибка при проверке оплаты для подписки ${subscriptionId} пользователя ${chatId}:`, error);
        await bot.sendMessage(chatId, 'Произошла ошибка при проверке оплаты. Пожалуйста, попробуйте позже.');
        await sendMainMenu(bot, chatId);
    }
};

const mySubscriptionsHandler = async (bot, chatId, callbackQueryId) => {
    const telegram_id = (await bot.getChat(chatId)).id;

    await bot.answerCallbackQuery(callbackQueryId, { text: 'Загружаю ваши подписки...' });

    try {
        const user = await User.findOne({ where: { telegram_id } });
        if (!user) {
            await bot.sendMessage(chatId, 'Не удалось найти ваш профиль. Пожалуйста, начните с команды /start.');
            await sendMainMenu(bot, chatId);
            return;
        }

        const subscriptions = await subscriptionService.getUserSubscriptions(user.id);

        if (subscriptions.length === 0) {
            await bot.sendMessage(chatId, 'У вас пока нет активных или завершенных подписок.');
            await sendMainMenu(bot, chatId, 'Что еще могу сделать?');
            return;
        }

        let message = '📊 *Ваши подписки:*\n\n';
        const inlineKeyboard = [];

        for (const sub of subscriptions) {
            const now = new Date();
            let statusIcon = '❓';
            let statusText = 'Неизвестно';
            let endDateText = '';
            let isExpired = false;

            if (sub.is_paid && sub.is_active && sub.end_date && sub.end_date >= now) {
                statusIcon = '✅';
                statusText = 'Активна';
                endDateText = ` до *${sub.end_date.toLocaleDateString('ru-RU')}*`;
            } else if (sub.is_paid && sub.is_active && sub.end_date && sub.end_date < now) {
                statusIcon = 'Expired'; // Для внутренних нужд, не отображаем напрямую
                statusText = 'Завершена (срок истек)';
                endDateText = ` (истекла *${sub.end_date.toLocaleDateString('ru-RU')}*)`;
                isExpired = true;
                // В реальном приложении здесь можно было бы деактивировать подписку
                // await subscriptionService.updateSubscription(sub.id, { is_active: false });
            } else if (sub.is_paid && !sub.is_active) {
                statusIcon = '🚫';
                statusText = 'Неактивна (оплачена, но деактивирована)';
            } else if (!sub.is_paid) {
                statusIcon = '⏳';
                statusText = 'Ожидает оплаты';
            }

            message += `*Тариф:* ${sub.tariff.name}\n` +
                       `*Статус:* ${statusIcon} ${statusText}${endDateText}\n`;

            if (sub.is_active && sub.hiddify_key && !isExpired) {
                message += `*Ваш ключ:* \`${sub.hiddify_key.substring(0, 30)}...\`\n`;
                inlineKeyboard.push([{ text: `🔑 Ключ для ${sub.tariff.name}`, callback_data: `get_key_${sub.id}` }]);
            } else if (!sub.is_paid) {
                message += `*Ожидает оплаты.* Нажмите "Оплатить" ниже.\n`;
                const payment = await paymentService.createPaymentLink(
                    sub.tariff.price,
                    `Повторная оплата тарифа "${sub.tariff.name}" (подписка ${sub.id})`,
                    `sub_${sub.id}`
                );
                if (payment && payment.paymentLink) {
                     inlineKeyboard.push([{ text: `💳 Оплатить ${sub.tariff.name} (${sub.tariff.price} руб.)`, url: payment.paymentLink }]);
                     inlineKeyboard.push([{ text: `✅ Я оплатил(а) (${sub.tariff.name})`, callback_data: `check_payment_${sub.id}` }]);
                } else {
                     message += `Не удалось сгенерировать ссылку для повторной оплаты.\n`;
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

    } catch (error) {
        console.error(`❌ Ошибка получения подписок для пользователя ${chatId}:`, error);
        await bot.sendMessage(chatId, 'Произошла ошибка при загрузке ваших подписок. Пожалуйста, попробуйте позже.');
        await sendMainMenu(bot, chatId);
    }
};

/**
 * Обработчик для получения ключа активной подписки
 */
const getKeyHandler = async (bot, chatId, callbackQueryId, callbackData) => {
    const subscriptionId = parseInt(callbackData.split('_')[2], 10);
    const telegram_id = (await bot.getChat(chatId)).id;

    await bot.answerCallbackQuery(callbackQueryId, { text: 'Генерирую ваш ключ...' });

    try {
        const user = await User.findOne({ where: { telegram_id } });
        if (!user) {
            await bot.sendMessage(chatId, 'Не удалось найти ваш профиль. Пожалуйста, начните с команды /start.');
            await sendMainMenu(bot, chatId);
            return;
        }

        const subscription = await subscriptionService.getSubscriptionById(subscriptionId);
        if (!subscription || subscription.user_id !== user.id) {
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
        } else {
            await bot.sendMessage(chatId, 'Эта подписка неактивна или ее срок истек. Вы не можете получить ключ.');
        }
        await sendMainMenu(bot, chatId, 'Что еще могу сделать?');

    } catch (error) {
        console.error(`❌ Ошибка получения ключа для подписки ${subscriptionId} пользователя ${chatId}:`, error);
        await bot.sendMessage(chatId, 'Произошла ошибка при получении ключа. Пожалуйста, попробуйте позже.');
        await sendMainMenu(bot, chatId);
    }
};

module.exports = {
    checkPaymentAndActivateHandler,
    mySubscriptionsHandler,
    getKeyHandler // Экспортируем новый обработчик
};