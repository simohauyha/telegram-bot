// backend/src/services/paymentService.js

const paymentService = {
    /**
     * Имитирует создание платежной ссылки.
     * В реальном приложении здесь был бы вызов к платежной системе (ЮKassa, Stripe, etc.).
     * @param {number} amount - Сумма платежа.
     * @param {string} description - Описание платежа.
     * @param {string} orderId - Уникальный ID заказа (или подписки).
     * @returns {Object} Объект с платежной ссылкой и статусом.
     */
    async createPaymentLink(amount, description, orderId) {
        console.log(`[PaymentService] Запрос на создание платежной ссылки: Сумма: ${amount}, Описание: ${description}, Заказ: ${orderId}`);
        // В реальном сценарии здесь будет интеграция с платежной системой.
        // Например: const response = await axios.post('https://api.paymentgateway.com/create', { ... });

        // Имитируем успешное создание ссылки
        const mockPaymentLink = `https://mock-payment-gateway.com/pay?amount=${amount}&order=${orderId}`;
        console.log(`[PaymentService] Платежная ссылка сгенерирована (заглушка): ${mockPaymentLink}`);

        return {
            paymentLink: mockPaymentLink,
            status: 'pending' // Статус: ожидание оплаты
        };
    },

    /**
     * Имитирует проверку статуса платежа.
     * В реальном приложении здесь был бы вызов к платежной системе.
     * @param {string} paymentId - ID платежа.
     * @returns {Object} Объект со статусом платежа.
     */
    async checkPaymentStatus(paymentId) {
        console.log(`[PaymentService] Запрос на проверку статуса платежа ID: ${paymentId}`);
        // В реальном сценарии здесь будет опрос платежной системы или обработка вебхука.
        // Для заглушки всегда возвращаем "оплачено".
        console.log(`[PaymentService] Статус платежа (заглушка): paid`);
        return {
            status: 'paid' // Имитируем, что платеж всегда успешен
        };
    }
};

module.exports = paymentService;