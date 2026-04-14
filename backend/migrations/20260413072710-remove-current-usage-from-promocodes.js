// backend/migrations/XXXXXX-remove-current-usage-from-promocodes.js
'use strict';
module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('Promocodes', 'current_usage');
    },
    down: async (queryInterface, Sequelize) => {
        // Если нужно откатить, добавьте колонку обратно
        await queryInterface.addColumn('Promocodes', 'current_usage', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        });
    }
};