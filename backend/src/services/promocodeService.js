// backend/src/services/promocodeService.js
const { Promocode, UserPromocode, User, Sequelize, Subscription } = require('../../models'); // <-- ДОБАВИТЬ Subscription
const { Op } = require('sequelize');

const promocodeService = {
    /**
     * Находит промокод по его коду и проверяет его валидность.
     * @param {string} code - Код промокода.
     * @returns {Promise<Promocode|null>} Валидный промокод или null.
     */
    async findValidPromocode(code) {
        const now = new Date();
        return Promocode.findOne({
            where: {
                code: code.toUpperCase(),
                is_active: true,
                [Op.and]: [
                    { [Op.or]: [ { expires_at: { [Op.gte]: now } }, { expires_at: null } ] }
                    // Лимит использования теперь проверяется ниже, через подсчет UserPromocodes
                ]
            }
        });
    },

    /**
     * Проверяет, активировал ли пользователь уже этот промокод.
     * Активацией считается запись в UserPromocode с is_applied = true,
     * либо существующий UserPromocode, который уже пытались применить к другой подписке
     * (чтобы промокод был "потрачен" на одну подписку).
     * @param {number} userId - ID пользователя.
     * @param {number} promocodeId - ID промокода.
     * @returns {Promise<boolean>} true, если пользователь уже активировал промокод для успешной покупки, иначе false.
     */
    async hasUserAppliedPromocode(userId, promocodeId) { // <-- ИЗМЕНЕНО ИМЯ ФУНКЦИИ
        const activation = await UserPromocode.findOne({
            where: {
                user_id: userId,
                promocode_id: promocodeId,
                is_applied: true // Проверяем, был ли промокод успешно применён к оплаченной подписке
            }
        });
        return !!activation;
    },

    /**
     * Проверяет, был ли промокод использован в рамках его лимита.
     * @param {Promocode} promocode - Объект промокода.
     * @returns {Promise<boolean>} true, если промокод можно использовать, иначе false.
     */
    async checkPromocodeUsageLimit(promocode) {
        if (promocode.usage_limit === null) {
            return true; // Безлимитный
        }
        // Подсчитываем, сколько раз промокод был успешно применен к оплаченным подпискам
        const appliedCount = await UserPromocode.count({
            where: {
                promocode_id: promocode.id,
                is_applied: true // Считаем только успешно примененные
            }
        });
        return appliedCount < promocode.usage_limit;
    },

    /**
     * "Активирует" промокод для пользователя, создавая запись в UserPromocodes.
     * Это лишь "привязка" промокода к пользователю для будущей покупки, но не его "потребление".
     * @param {number} userId - ID пользователя.
     * @param {Promocode} promocode - Объект промокода.
     * @returns {Promise<UserPromocode>} Запись об активации.
     */
    async registerPromocodeActivation(userId, promocode) { // <-- ИЗМЕНЕНО ИМЯ ФУНКЦИИ
        // Сначала проверяем, есть ли уже активная (не примененная) "регистрация" для этого пользователя и промокода
        const existingActivation = await UserPromocode.findOne({
            where: {
                user_id: userId,
                promocode_id: promocode.id,
                is_applied: false // Ищем незавершенную активацию
            }
        });

        if (existingActivation) {
            return existingActivation; // Если уже есть, используем её
        }

        // Если нет, создаем новую "регистрацию"
        return UserPromocode.create({
            user_id: userId,
            promocode_id: promocode.id,
            activated_at: new Date(),
            is_applied: false, // Пока не применен
            applied_to_subscription_id: null
        });
    },

    /**
     * Отмечает промокод как успешно примененный к подписке.
     * Вызывается после успешной оплаты.
     * @param {number} userId - ID пользователя.
     * @param {number} promocodeId - ID промокода.
     * @param {number} subscriptionId - ID подписки, к которой применен промокод.
     * @returns {Promise<boolean>} true, если успешно помечено.
     */
    async markPromocodeAsApplied(userId, promocodeId, subscriptionId) {
        const activation = await UserPromocode.findOne({
            where: {
                user_id: userId,
                promocode_id: promocodeId,
                is_applied: false // Ищем незавершенную активацию для этого пользователя и промокода
            }
        });

        if (activation) {
            await activation.update({
                is_applied: true,
                applied_to_subscription_id: subscriptionId
            });
            return true;
        }
        return false; // Активация не найдена или уже применена
    },

    /**
     * Применяет скидку промокода к указанной сумме.
     * @param {number} amount - Исходная сумма.
     * @param {number} discountPercentage - Процент скидки (например, 10 для 10%).
     * @returns {number} Сумма со скидкой.
     */
    applyDiscount(amount, discountPercentage) {
        if (discountPercentage < 0 || discountPercentage > 100) {
            throw new Error('Процент скидки должен быть от 0 до 100.');
        }
        const discountAmount = amount * (discountPercentage / 100);
        return Math.max(0, amount - discountAmount);
    }
};

module.exports = promocodeService;