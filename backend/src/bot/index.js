// backend/src/bot/index.js
const TelegramBot = require('node-telegram-bot-api');
const registerCommands = require('./commands');
const registerCallbacks = require('./callbacks');
const { getUserState, setUserState, resetUserState, states } = require('./utils/conversationStates');
const promocodeService = require('../services/promocodeService');
const userService = require('../services/userService');
const { sendMainMenu } = require('./utils/menu');
// <-- ДОБАВИТЬ Promocode для checkPromocodeUsageLimit
const { Promocode } = require('../../models');

/**
 * Инициализирует и запускает Telegram-бота, регистрирует команды и колбэки.
 * @returns {TelegramBot|null} Экземпляр бота или null, если токен не установлен.
 */
function initializeBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
        console.error('🚫 КРИТИЧЕСКАЯ ОШИБКА: TELEGRAM_BOT_TOKEN не установлен в .env. Бот не будет запущен.');
        return null;
    }

    const bot = new TelegramBot(token, { polling: true });

    registerCommands(bot);
    registerCallbacks(bot);

    // <-- ОБРАБОТЧИК ТЕКСТОВЫХ СООБЩЕНИЙ -->
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;
        const telegram_id = msg.from.id;

        // Если сообщение не текстовое (например, стикер, фото) - игнорируем его
        if (!text) {
            console.log(`💬 Получено нетекстовое сообщение от пользователя ${chatId}. Игнорирую.`);
            return;
        }

        // Игнорируем команды, они обрабатываются отдельно через bot.onText
        if (text.startsWith('/')) {
            console.log(`💬 Получена команда "${text}" от пользователя ${chatId}. Игнорирую в этом обработчике.`);
            return;
        }

        const userCurrentStep = getUserState(chatId, states.CURRENT_STEP);
        console.log(`💬 Получено текстовое сообщение "${text}" от пользователя ${chatId}. Текущий шаг: "${userCurrentStep}"`);


        // --- Логика обработки промокода ---
        if (userCurrentStep === states.AWAITING_PROMOCODE) {
            try {
                const user = await userService.findUserByTelegramId(telegram_id);
                if (!user) {
                    console.warn(`⚠️ Попытка ввода промокода от неизвестного пользователя ${telegram_id}`);
                    await bot.sendMessage(chatId, 'Не удалось найти ваш профиль. Пожалуйста, начните с команды /start.');
                    await sendMainMenu(bot, chatId);
                    resetUserState(chatId); // Полный сброс
                    return;
                }

                const promocode = await promocodeService.findValidPromocode(text);

                if (!promocode) {
                    console.log(`ℹ️ Недействительный или истекший промокод "${text}" для пользователя ${telegram_id}`);
                    await bot.sendMessage(chatId, 'Извините, промокод не найден, недействителен или его срок действия истек. Попробуйте другой.');
                    // Остаемся в состоянии AWAITING_PROMOCODE, чтобы пользователь мог ввести другой промокод
                    return;
                }

                // <-- ИЗМЕНЕНО: Проверка лимита использования промокода -->
                // NOTE: This Promocode model comes from require('../../models') above.
                // We need to fetch the full Promocode object if we only have promocode.id
                // No, promocode is already a Promocode instance from findValidPromocode.
                // The Promocode model imported above is for association in other places, not this check.
                // We should call Promocode.findByPk(promocode.id) if we need to ensure it's a model instance here.
                // For now, assume `promocode` from findValidPromocode is a full instance.
                const isLimitAvailable = await promocodeService.checkPromocodeUsageLimit(promocode);
                if (!isLimitAvailable) {
                    console.log(`ℹ️ Промокод "${promocode.code}" (ID: ${promocode.id}) исчерпал лимит использования.`);
                    await bot.sendMessage(chatId, 'Извините, лимит использования этого промокода исчерпан. Пожалуйста, попробуйте другой.');
                    setUserState(chatId, states.CURRENT_STEP, null); // Сбрасываем состояние
                    await sendMainMenu(bot, chatId);
                    return;
                }


                // <-- ИЗМЕНЕНО: ИСПОЛЬЗУЕМ НОВУЮ ФУНКЦИЮ ДЛЯ ПРОВЕРКИ, БЫЛ ЛИ ПРОМОКОД УЖЕ ПРИМЕНЕН -->
                const alreadyAppliedByUser = await promocodeService.hasUserAppliedPromocode(user.id, promocode.id);
                if (alreadyAppliedByUser) {
                    console.log(`ℹ️ Промокод "${promocode.code}" (ID: ${promocode.id}) уже был успешно применен пользователем ${telegram_id}.`);
                    await bot.sendMessage(chatId, 'Вы уже использовали этот промокод для оплаты подписки ранее. Один промокод может быть применен только один раз к оплаченной подписке.');
                    resetUserState(chatId); // Полный сброс
                    await sendMainMenu(bot, chatId);
                    return;
                }

                // <-- ИЗМЕНЕНО: РЕГИСТРИРУЕМ АКТИВАЦИЮ, НО НЕ "ПОТРЕБЛЯЕМ" ПРОМОКОД -->
                const userPromocodeActivation = await promocodeService.registerPromocodeActivation(user.id, promocode);

                // Сохраняем ID активации, а не ID промокода, чтобы отслеживать конкретный случай "пользователь ввёл промокод"
                setUserState(chatId, states.ACTIVE_PROMOCODE_ID, userPromocodeActivation.id);
                // Сбрасываем только CURRENT_STEP, ACTIVE_PROMOCODE_ID остается
                setUserState(chatId, states.CURRENT_STEP, null);

                console.log(`✅ Промокод "${promocode.code}" успешно зарегистрирован для пользователя ${telegram_id}. ID активации: ${userPromocodeActivation.id}`);

                await bot.sendMessage(chatId,
                    `🎉 *Поздравляем! Промокод "${promocode.code}" активирован!* 🎉\n` +
                    `Вы получили скидку *${promocode.discount_percentage}%* на следующую покупку.`,
                    { parse_mode: 'Markdown' }
                );

                await sendMainMenu(bot, chatId, 'Теперь выберите тарифы для покупки со скидкой!');

            } catch (error) {
                console.error(`❌ Ошибка обработки промокода "${text}" для пользователя ${telegram_id}:`, error);
                await bot.sendMessage(chatId, 'Произошла ошибка при обработке промокода. Пожалуйста, попробуйте позже.');
                resetUserState(chatId); // Полный сброс состояния при ошибке
                await sendMainMenu(bot, chatId);
            }
        }
        else {
            // Если нет активного шага, отправляем главное меню
            console.log(`ℹ️ Неизвестное текстовое сообщение "${text}" от пользователя ${chatId}. Шаг: "${userCurrentStep}". Отправляю главное меню.`);
            await bot.sendMessage(chatId, 'Я не понял вашу команду. Пожалуйста, выберите опцию из меню.');
            await sendMainMenu(bot, chatId);
        }
    });
    // <-- КОНЕЦ ОБРАБОТЧИКА ТЕКСТОВЫХ СООБЩЕНИЙ -->

    return bot;
}

module.exports = initializeBot;