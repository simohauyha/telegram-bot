'use strict';
module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('Subscriptions', 'promocode_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'Promocodes', // Имя таблицы Promocodes
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        });
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('Subscriptions', 'promocode_id');
    }
};