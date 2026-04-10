// backend/src/bot/callbacks/tariffsCallbacks.js
const tariffService = require('../../services/tariffService');
const subscriptionService = require('../../services/subscriptionService');
const hiddifyService = require('../../services/hiddifyService');
const paymentService = require('../../services/paymentService');
const { sendMainMenu } = require('../utils/menu');
const { User, Tariff } = require('../../../models');

const tariffsListHandler = async (bot, chatId, callbackQueryId) => { // Это просто функция
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Загружаю тарифы...' });

    try {
        const activeTariffs = await tariffService.getActiveTariffsSortedByPrice();

        if (activeTariffs.length === 0) {
            await bot.sendMessage(chatId, 'К сожалению, активных тарифов пока нет.');
            await sendMainMenu(bot, chatId, 'Что еще могу сделать?');
            return;
        }

        let tariffsMessage = '✨ Наши тарифы:\n\n';
        const tariffButtons = [];

        activeTariffs.forEach(tariff => {
            tariffsMessage += `*${tariff.name}*\n` +
                `Цена: *${tariff.price}* руб.\n` +
                `Длительность: *${tariff.duration_days}* дней\n` +
                `${tariff.description || 'Нет описания.'}\n\n`;
            tariffButtons.push([{ text: `Купить ${tariff.name} (${tariff.price} руб.)`, callback_data: `buy_tariff_${tariff.id}` }]);
        });

        tariffButtons.push([{ text: '↩️ Назад в меню', callback_data: 'main_menu' }]);

        await bot.sendMessage(chatId, tariffsMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: tariffButtons
            }
        });

    } catch (error) {
        console.error(`❌ Ошибка получения тарифов для чата ${chatId}:`, error);
        await bot.sendMessage(chatId, 'Произошла ошибка при загрузке тарифов. Пожалуйста, попробуйте позже.');
        await sendMainMenu(bot, chatId, 'Что еще могу сделать?');
    }
};

const buyTariffHandler = async (bot, chatId, callbackQueryId, tariffId) => { 
    const telegram_id = (await bot.getChat(chatId)).id;

    await bot.answerCallbackQuery(callbackQueryId, { text: `Выбран тариф ID: ${tariffId}.` });

    try {
        const user = await User.findOne({ where: { telegram_id } });
        const tariff = await Tariff.findByPk(tariffId);

        if (!user || !tariff) {
            await bot.sendMessage(chatId, 'Не удалось найти пользователя или выбранный тариф. Пожалуйста, попробуйте снова.');
            await sendMainMenu(bot, chatId, 'Возвращаюсь в главное меню.');
            return;
        }

        const existingActiveSubscription = await subscriptionService.findActiveSubscriptionForUser(user.id);
        if (existingActiveSubscription) {
            await bot.sendMessage(chatId, 'У вас уже есть активная подписка. Вы можете управлять ею в разделе "Мои подписки".', {
                reply_markup: {
                    inline_keyboard: [[{ text: 'Мои подписки', callback_data: 'my_subscriptions' }]]
                }
            });
            return;
        }

        const hiddify = await hiddifyService.generateHiddifyAccessKey(user.id, tariff.name);
        const subscription = await subscriptionService.createSubscription({
            user_id: user.id,
            tariff_id: tariff.id,
            hiddify_key: hiddify.hiddifyKey,
            hiddify_uuid: hiddify.hiddifyUuid,
            is_active: false,
            is_paid: false
        });

        const payment = await paymentService.createPaymentLink(
            tariff.price,
            `Оплата тарифа "${tariff.name}" на ${tariff.duration_days} дней`,
            `sub_${subscription.id}`
        );

        if (!payment || !payment.paymentLink) {
            await bot.sendMessage(chatId, 'Не удалось сгенерировать платежную ссылку. Пожалуйста, свяжитесь с поддержкой.');
            console.error(`❌ Ошибка: Не удалось сгенерировать платежную ссылку для подписки ${subscription.id}`);
            await sendMainMenu(bot, chatId, 'Возвращаюсь в главное меню.');
            return;
        }

        await bot.sendMessage(chatId,
            `*Вы выбрали тариф "${tariff.name}"!*\n\n` +
            `К оплате: *${tariff.price}* руб.\n` +
            `Длительность: *${tariff.duration_days}* дней.\n\n` +
            `Для оплаты перейдите по ссылке ниже. После успешной оплаты ваш VPN-доступ будет активирован:\n` +
            `[Оплатить](<${payment.paymentLink}>)\n\n` + 
            `Пожалуйста, не закрывайте это окно до завершения оплаты.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Перейти к оплате', url: payment.paymentLink }],
                        [{ text: '✅ Я оплатил(а)', callback_data: `check_payment_${subscription.id}` }],
                        [{ text: '↩️ Отменить и вернуться в меню', callback_data: `cancel_purchase_${subscription.id}` }]
                    ]
                }
            }
        );

    } catch (error) {
        console.error(`❌ Ошибка при обработке покупки тарифа ID ${tariffId} для пользователя ${chatId}:`, error);
        await bot.sendMessage(chatId, 'Произошла ошибка при попытке оформить подписку. Пожалуйста, попробуйте позже.');
        await sendMainMenu(bot, chatId, 'Возвращаюсь в главное меню.');
    }
};

module.exports = { 
    tariffsListHandler,
    buyTariffHandler
};