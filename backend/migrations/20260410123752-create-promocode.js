// backend/migrations/XXXXXX-create-promocode.js
'use strict';
module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('Promocodes', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            code: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true
            },
            discount_percentage: {
                type: Sequelize.DECIMAL(5, 2),
                allowNull: false,
                defaultValue: 0
            },
            usage_limit: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
            current_usage: { // Добавляем это поле в миграцию
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: true
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('Promocodes');
    }
};