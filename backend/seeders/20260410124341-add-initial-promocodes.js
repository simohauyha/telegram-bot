// backend/seeders/XXXXXX-add-initial-promocodes.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const now = new Date();
        const nextMonth = new Date(now);
        nextMonth.setMonth(now.getMonth() + 1);

        await queryInterface.bulkInsert('Promocodes', [
            {
                code: 'SAVE10PERCENT',
                discount_percentage: 10.00,
                usage_limit: null,
                // current_usage: 0, // <-- УДАЛИТЬ ЭТУ СТРОКУ
                expires_at: null,
                is_active: true,
                created_at: now,
                updated_at: now
            },
            {
                code: 'NEWUSERBONUS',
                discount_percentage: 15.00,
                usage_limit: 100,
                // current_usage: 0, // <-- УДАЛИТЬ ЭТУ СТРОКУ
                expires_at: null,
                is_active: true,
                created_at: now,
                updated_at: now
            },
            {
                code: 'APRILFOOLS',
                discount_percentage: 5.00,
                usage_limit: 50,
                // current_usage: 0, // <-- УДАЛИТЬ ЭТУ СТРОКУ
                expires_at: nextMonth,
                is_active: true,
                created_at: now,
                updated_at: now
            },
            {
                code: 'OLDCODE',
                discount_percentage: 20.00,
                usage_limit: null,
                // current_usage: 0, // <-- УДАЛИТЬ ЭТУ СТРОКУ
                expires_at: new Date(new Date().setDate(new Date().getDate() - 1)),
                is_active: false,
                created_at: now,
                updated_at: now
            },
            {
                code: 'SAVE5', // Промокод с лимитом использования
                discount_percentage: 5.00,
                usage_limit: 1, // Лимит 1 использование
                expires_at: null,
                is_active: true,
                created_at: now,
                updated_at: now
            }
        ], {});
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkDelete('Promocodes', null, {});
    }
};