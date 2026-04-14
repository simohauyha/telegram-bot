// backend/src/bot/utils/cleanupService.js
const subscriptionService = require('../../services/subscriptionService');
const { Promocode, UserPromocode, Sequelize } = require('../../../models'); // Для UserPromocode
const { getUserState, setUserState, states, resetUserState } = require('./conversationStates'); // Для состояний

/**
 * Проверяет наличие неоплаченных/неактивных подписок и связанных промокодов в состоянии пользователя
 * и удаляет их, если они не были оплачены.
 * Вызывается при переходе пользователя к другим действиям.
 * @param {number} chatId - ID чата пользователя.
 */
async function cleanupPendingPurchase(chatId) {
    const pendingSubscriptionId = getUserState(chatId, states.PENDING_SUBSCRIPTION_ID);
    const activeUserPromocodeActivationId = getUserState(chatId, states.ACTIVE_PROMOCODE_ID);

    if (pendingSubscriptionId) {
        console.log(`[CLEANUP] Обнаружена висящая подписка ID ${pendingSubscriptionId} для пользователя ${chatId}.`);
        const subscription = await subscriptionService.getSubscriptionById(pendingSubscriptionId);

        if (subscription && !subscription.is_paid && !subscription.is_active) {
            console.log(`[CLEANUP] Удаляю неоплаченную подписку ID ${pendingSubscriptionId}.`);
            await subscriptionService.deleteSubscription(pendingSubscriptionId);

            // Если был привязан промокод через активацию
            if (activeUserPromocodeActivationId) {
                const userPromocodeActivation = await UserPromocode.findByPk(activeUserPromocodeActivationId);
                if (userPromocodeActivation && !userPromocodeActivation.is_applied) {
                    console.log(`[CLEANUP] Удаляю неиспользованную активацию промокода ID ${activeUserPromocodeActivationId}.`);
                    await userPromocodeActivation.destroy(); // Удаляем запись активации
                }
            }
            // Уведомляем пользователя только если это не было явной отменой
            // (в случае явной отмены, бот уже отправил сообщение)
        }
        setUserState(chatId, states.PENDING_SUBSCRIPTION_ID, null); // Очищаем состояние
    }

    // Дополнительно, если промокод был активирован, но не привязан ни к одной подписке,
    // и пользователь ушел, мы его тоже можем очистить, чтобы можно было ввести заново.
    // (Это уже делается путем сброса activePromocodeId из состояния пользователя в tariffsCallbacks.js
    // и в index.js при активации. Поэтому, если pendingSubscriptionId == null, но activePromocodeId != null,
    // это означает, что activePromocodeId уже очищен в другом месте.)
    // resetUserState(chatId); // Полный сброс состояния можно здесь, но аккуратно
    // Сброс `ACTIVE_PROMOCODE_ID` происходит в `tariffsCallbacks.js` после попытки применения.
    // Поэтому, здесь нам достаточно проверить `PENDING_SUBSCRIPTION_ID`.
}

module.exports = {
    cleanupPendingPurchase
};