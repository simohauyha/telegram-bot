// backend/migrations/XXXXXX-add-applied-fields-to-user-promocodes.js
'use strict';
module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('UserPromocodes', 'is_applied', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });
        await queryInterface.addColumn('UserPromocodes', 'applied_to_subscription_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            unique: true, // Обеспечивает, что 1 активация промокода = 1 примененная подписка
            references: {
                model: 'Subscriptions',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        });
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeConstraint('UserPromocodes', 'UserPromocodes_applied_to_subscription_id_fkey'); // Проверьте имя, может отличаться
        await queryInterface.removeColumn('UserPromocodes', 'applied_to_subscription_id');
        await queryInterface.removeColumn('UserPromocodes', 'is_applied');
    }
};