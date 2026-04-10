// backend/src/services/subscriptionService.js
const { Subscription, User, Tariff } = require('../../models');
const { Op } = require('sequelize'); // Для операторов Sequelize

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
            returning: true, // Возвращает обновленные записи
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
                // Дополнительно: endDate должен быть в будущем
                end_date: {
                    [Op.gte]: now
                }
            },
            include: [{ model: Tariff, as: 'tariff' }]
        });
    },

    /**
     * Получает все подписки пользователя.
     * @param {number} userId - ID пользователя.
     * @returns {Promise<Subscription[]>} Массив подписок.
     */
    async getUserSubscriptions(userId) {
        return Subscription.findAll({
            where: { user_id: userId },
            include: [{ model: Tariff, as: 'tariff' }],
            order: [['created_at', 'DESC']]
        });
    }
    // Здесь будут другие методы для работы с подписками
};

module.exports = subscriptionService;
