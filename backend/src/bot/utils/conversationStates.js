// backend/src/bot/utils/conversationStates.js
const userConversationStates = new Map(); // Хранит Map<chatId, Map<string, any>>

/**
 * Устанавливает или обновляет состояние разговора для пользователя.
 * @param {number} userId - ID пользователя Telegram.
 * @param {string|null} stateKey - Ключ состояния (например, 'currentStep', 'activePromocodeId').
 * @param {any} value - Значение для установки. Если null, удаляет ключ.
 */
function setUserState(userId, stateKey, value) {
    let userStateMap = userConversationStates.get(userId);

    if (!userStateMap) {
        userStateMap = new Map();
        userConversationStates.set(userId, userStateMap);
    }

    if (value === null) {
        userStateMap.delete(stateKey);
    } else {
        userStateMap.set(stateKey, value);
    }

    // Если userStateMap пуст, удаляем запись о пользователе
    if (userStateMap.size === 0) {
        userConversationStates.delete(userId);
    }
}

/**
 * Получает значение состояния разговора для пользователя по ключу.
 * @param {number} userId - ID пользователя Telegram.
 * @param {string} stateKey - Ключ состояния.
 * @returns {any|null} Значение состояния или null, если нет активного состояния.
 */
function getUserState(userId, stateKey) {
    const userStateMap = userConversationStates.get(userId);
    return userStateMap ? (userStateMap.get(stateKey) || null) : null;
}

/**
 * Полностью сбрасывает все состояния для пользователя.
 * @param {number} userId - ID пользователя Telegram.
 */
function resetUserState(userId) {
    userConversationStates.delete(userId);
}

module.exports = {
    setUserState,
    getUserState,
    resetUserState, // <-- ДОБАВЛЕНО
    states: { // Константы для состояний
        CURRENT_STEP: 'CURRENT_STEP', // <-- ИЗМЕНЕНО: теперь это общий ключ для шага
        AWAITING_PROMOCODE: 'AWAITING_PROMOCODE',
        ACTIVE_PROMOCODE_ID: 'ACTIVE_PROMOCODE_ID', 
        PENDING_SUBSCRIPTION_ID: 'PENDING_SUBSCRIPTION_ID', //+
    }
};