// backend/src/services/subscriptionService.js
const { Subscription, User, Tariff } = require('../../models');
const { Op } = require('sequelize');

const subscriptionService = {
    /**
     * Создает новую запись подписки.
     * @param {Object} subscriptionData - Данные для создания подписки.
     * @returns {Promise<Subscription>} Созданная подписка.
     */
    async createSubscription(subscriptionData) {
        return Subscription.create(subscriptionData);
    },

    /**
     * Обновляет существующую запись подписки.
     * @param {number} id - ID подписки.
     * @param {Object} updateData - Данные для обновления.
     * @returns {Promise<[number, Subscription[]]>} Массив с количеством обновленных записей и самими записями.
     */
    async updateSubscription(id, updateData) {
        return Subscription.update(updateData, {
            where: { id },
            returning: true,
        });
    },

    /**
     * Получает подписку по ID.
     * @param {number} id - ID подписки.
     * @returns {Promise<Subscription|null>} Подписка или null.
     */
    async getSubscriptionById(id) {
        return Subscription.findByPk(id, {
            include: [{ model: User, as: 'user' }, { model: Tariff, as: 'tariff' }]
        });
    },

    /**
     * Находит активную подписку для пользователя.
     * Активной считается оплаченная и не истекшая подписка.
     * @param {number} userId - ID пользователя.
     * @returns {Promise<Subscription|null>} Активная подписка или null.
     */
    async findActiveSubscriptionForUser(userId) {
        const now = new Date();
        return Subscription.findOne({
            where: {
                user_id: userId,
                is_active: true,
                is_paid: true,
                end_date: {
                    [Op.gte]: now // Дата окончания должна быть больше или равна текущей
                }
            },
            include: [{ model: Tariff, as: 'tariff' }]
        });
    },

    /**
     * Получает все подписки пользователя (для внутреннего использования, без фильтрации).
     * Фильтрация для отображения в боте будет на уровне UI.
     * @param {number} userId - ID пользователя.
     * @returns {Promise<Subscription[]>} Массив подписок.
     */
    async getUserSubscriptions(userId) { // <-- ЛОГИКА ОСТАЕТСЯ, но фильтрация UI
        return Subscription.findAll({
            where: { user_id: userId },
            include: [{ model: Tariff, as: 'tariff' }],
            order: [['created_at', 'DESC']]
        });
    },

    /**
     * Находит единственную неоплаченную и неактивную подписку для пользователя.
     * Используется для очистки "висящих" подписок.
     * @param {number} userId - ID пользователя.
     * @returns {Promise<Subscription|null>} Неоплаченная подписка или null.
     */
    async getPendingSubscriptionForUser(userId) { // <-- НОВАЯ ФУНКЦИЯ
        return Subscription.findOne({
            where: {
                user_id: userId,
                is_paid: false,
                is_active: false
            },
            order: [['created_at', 'DESC']] // Берем последнюю
        });
    },

    /**
     * Удаляет подписку по ID.
     * @param {number} subscriptionId - ID подписки для удаления.
     * @returns {Promise<number>} Количество удаленных записей.
     */
    async deleteSubscription(subscriptionId) { // <-- НОВАЯ ФУНКЦИЯ
        return Subscription.destroy({
            where: { id: subscriptionId }
        });
    }
};

module.exports = subscriptionService;