// backend/src/bot/callbacks/tariffsCallbacks.js
const tariffService = require('../../services/tariffService');
const subscriptionService = require('../../services/subscriptionService');
const hiddifyService = require('../../services/hiddifyService');
const paymentService = require('../../services/paymentService');
const { sendMainMenu } = require('../utils/menu');
// <-- ИМПОРТИРУЕМ ВСЕ НЕОБХОДИМЫЕ МОДЕЛИ И ОБЪЕКТ Sequelize -->
const { User, Tariff, Promocode, UserPromocode, Sequelize } = require('../../../models'); // <-- ДОБАВЛЕНО: UserPromocode и Sequelize
// <-- ИМПОРТИРУЕМ СЕРВИС ПРОМОКОДОВ И API СОСТОЯНИЙ -->
const promocodeService = require('../../services/promocodeService');
const { getUserState, resetUserState, setUserState, states } = require('../utils/conversationStates');
const { cleanupPendingPurchase } = require('../utils/cleanupService');


const tariffsListHandler = async (bot, chatId, callbackQueryId, data, callbackQuery) => {
    await cleanupPendingPurchase(chatId);
    await bot.answerCallbackQuery(callbackQueryId, { text: 'Загружаю тарифы...' });
    console.log(`[TARIFFS_LIST] Запрос списка тарифов от пользователя ${chatId}`);

    try {
        const activeTariffs = await tariffService.getActiveTariffsSortedByPrice();

        if (activeTariffs.length === 0) {
            console.warn(`[TARIFFS_LIST] Активных тарифов не найдено для пользователя ${chatId}.`);
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
        console.log(`[TARIFFS_LIST] Тарифы успешно отправлены пользователю ${chatId}.`);

    } catch (error) {
        console.error(`❌ Ошибка получения тарифов для чата ${chatId}:`, error);
        await bot.sendMessage(chatId, 'Произошла ошибка при загрузке тарифов. Пожалуйста, попробуйте позже.');
        await sendMainMenu(bot, chatId, 'Что еще могу сделать?');
    }
};

const buyTariffHandler = async (bot, chatId, callbackQueryId, tariffId, callbackQuery) => {
    const telegram_id = callbackQuery.from.id;
    console.log(`[BUY_TARIFF] Пользователь ${telegram_id} инициировал покупку тарифа ID: ${tariffId}.`);

    await bot.answerCallbackQuery(callbackQueryId, { text: `Выбран тариф ID: ${tariffId}.` });

    try {
        const user = await User.findOne({ where: { telegram_id } });
        const tariff = await Tariff.findByPk(tariffId);

        if (!user || !tariff) {
            console.warn(`[BUY_TARIFF] Пользователь ${telegram_id} или тариф ${tariffId} не найден.`);
            await bot.sendMessage(chatId, 'Не удалось найти пользователя или выбранный тариф. Пожалуйста, попробуйте снова.');
            await sendMainMenu(bot, chatId, 'Возвращаюсь в главное меню.');
            resetUserState(chatId);
            return;
        }

        console.log(`[BUY_TARIFF] Пользователь ${telegram_id} выбрал тариф "${tariff.name}" (ID: ${tariffId}, Исходная цена: ${tariff.price}).`);

        const existingActiveSubscription = await subscriptionService.findActiveSubscriptionForUser(user.id);
        if (existingActiveSubscription) {
            console.log(`[BUY_TARIFF] У пользователя ${telegram_id} уже есть активная подписка (ID: ${existingActiveSubscription.id}).`);
            await bot.sendMessage(chatId, 'У вас уже есть активная подписка. Вы можете управлять ею в разделе "Мои подписки".', {
                reply_markup: {
                    inline_keyboard: [[{ text: 'Мои подписки', callback_data: 'my_subscriptions' }]]
                }
            });
            resetUserState(chatId);
            return;
        }

        // <-- ЛОГИКА ПРИМЕНЕНИЯ ПРОМОКОДА -->
        let finalPrice = parseFloat(tariff.price);
        let appliedPromocode = null;
        const activeUserPromocodeActivationId = getUserState(chatId, states.ACTIVE_PROMOCODE_ID); // <-- ИЗМЕНЕНО ИМЯ ПЕРЕМЕННОЙ

        console.log(`[PROMOCODE_APPLY] Начинаем проверку промокода. ActiveUserPromocodeActivationId из состояния пользователя ${chatId}: ${activeUserPromocodeActivationId}`); // <-- ИЗМЕНЕНО ЛОГ

        if (activeUserPromocodeActivationId) {
            const userPromocodeActivation = await UserPromocode.findByPk(activeUserPromocodeActivationId, { // <-- ИЗМЕНЕНО
                include: [{ model: Promocode, as: 'promocode' }]
            });
            const promocode = userPromocodeActivation ? userPromocodeActivation.promocode : null;

            console.log(`[PROMOCODE_APPLY] Найден UserPromocodeActivation по ID ${activeUserPromocodeActivationId}. Промокод: ${promocode ? promocode.code : 'Не найден в БД'}.`); // <-- ИЗМЕНЕНО ЛОГ

            const isPromocodeStillValid = promocode ?
                (await promocodeService.findValidPromocode(promocode.code) && await promocodeService.checkPromocodeUsageLimit(promocode)) : false;
            console.log(`[PROMOCODE_APPLY] Результат повторной валидации promocode: ${isPromocodeStillValid}`);


            if (promocode && isPromocodeStillValid) {
                finalPrice = promocodeService.applyDiscount(finalPrice, promocode.discount_percentage);
                appliedPromocode = promocode;
                console.log(`[PROMOCODE_APPLY] Промокод "${promocode.code}" применен. Исходная цена: ${tariff.price}, Итоговая цена со скидкой: ${finalPrice.toFixed(2)}.`);
                await bot.sendMessage(chatId, `💰 К вашей покупке применена скидка *${promocode.discount_percentage}%* по промокоду "${promocode.code}"!`, { parse_mode: 'Markdown' });
            } else {
                console.warn(`[PROMOCODE_APPLY] Промокод "${promocode ? promocode.code : 'unknown'}" (UserPromocodeActivation ID: ${activeUserPromocodeActivationId}) в состоянии пользователя недействителен или исчерпан при повторной проверке.`); // <-- ИЗМЕНЕНО ЛОГ
                await bot.sendMessage(chatId, 'Ваш примененный промокод оказался недействительным или истек. Покупка будет совершена по полной цене.');
            }
            // <-- Сбрасываем ACTIVE_PROMOCODE_ID из состояния после попытки его использования (независимо от успеха) -->
            setUserState(chatId, states.ACTIVE_PROMOCODE_ID, null);
            console.log(`[STATE] Пользователь ${chatId}: ACTIVE_PROMOCODE_ID сброшен из состояния после попытки использования.`);
        } else {
            console.log(`[PROMOCODE_APPLY] Активный промокод не найден в состоянии пользователя (activeUserPromocodeActivationId === null). Цена остается ${finalPrice.toFixed(2)}.`); // <-- ИЗМЕНЕНО ЛОГ
        }
        // <-- КОНЕЦ ЛОГИКИ ПРИМЕНЕНИЯ ПРОМОКОДА -->

        const hiddify = await hiddifyService.generateHiddifyAccessKey(user.id, tariff.name);
        const subscription = await subscriptionService.createSubscription({
            user_id: user.id,
            tariff_id: tariff.id,
            promocode_id: appliedPromocode ? appliedPromocode.id : null,
            hiddify_key: hiddify.hiddifyKey,
            hiddify_uuid: hiddify.hiddifyUuid,
            is_active: false,
            is_paid: false
        });
        console.log(`[BUY_TARIFF] Создана подписка ID: ${subscription.id} для пользователя ${telegram_id} с promocode_id: ${appliedPromocode ? appliedPromocode.id : 'нет'}.`);


        setUserState(chatId, states.PENDING_SUBSCRIPTION_ID, subscription.id);
        console.log(`[STATE] Пользователь ${chatId}: PENDING_SUBSCRIPTION_ID установлен на ${subscription.id}.`);
        
        // <-- ВАЖНО: ОТМЕТИТЬ ПРОМОКОД КАК ПРИМЕНЕННЫЙ К ЭТОЙ ПОДПИСКЕ (но пока не оплаченной) -->
        if (appliedPromocode && activeUserPromocodeActivationId) {
            await UserPromocode.update(
                { applied_to_subscription_id: subscription.id },
                { where: { id: activeUserPromocodeActivationId, user_id: user.id } }
            );
            console.log(`[PROMOCODE_APPLY] Активация промокода ID ${activeUserPromocodeActivationId} привязана к подписке ID ${subscription.id}.`);
        }

        const payment = await paymentService.createPaymentLink(
            finalPrice,
            `Оплата тарифа "${tariff.name}" на ${tariff.duration_days} дней`,
            `sub_${subscription.id}`
        );
        console.log(`[BUY_TARIFF] Создана платежная ссылка для подписки ${subscription.id}. К оплате: ${finalPrice.toFixed(2)}.`);


        if (!payment || !payment.paymentLink) {
            console.error(`❌ Ошибка: Не удалось сгенерировать платежную ссылку для подписки ${subscription.id} пользователя ${telegram_id}.`);
            await bot.sendMessage(chatId, 'Не удалось сгенерировать платежную ссылку. Пожалуйста, свяжитесь с поддержкой.');
            await sendMainMenu(bot, chatId, 'Возвращаюсь в главное меню.');
            resetUserState(chatId);
            return;
        }

        await bot.sendMessage(chatId,
            `*Вы выбрали тариф "${tariff.name}"!*\n\n` +
            `К оплате: *${finalPrice.toFixed(2)}* руб.${appliedPromocode ? ` (со скидкой ${appliedPromocode.discount_percentage}%)` : ''}\n` +
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
        console.log(`[BUY_TARIFF] Сообщение о покупке и оплате отправлено пользователю ${telegram_id}.`);


    } catch (error) {
        console.error(`❌ Ошибка при обработке покупки тарифа ID ${tariffId} для пользователя ${telegram_id}:`, error);
        await bot.sendMessage(chatId, 'Произошла ошибка при попытке оформить подписку. Пожалуйста, попробуйте позже.');
        resetUserState(chatId);
        await sendMainMenu(bot, chatId, 'Возвращаюсь в главное меню.');
    }
};

module.exports = {
    tariffsListHandler,
    buyTariffHandler
};