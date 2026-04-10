// backend/migrations/XXXXXXX-create-tariff.js
'use strict';
module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('Tariffs', { // Явно указываем имя таблицы
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false, // Название тарифа обязательно
                unique: true // Название тарифа должно быть уникальным
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true // Описание может быть пустым
            },
            price: {
                type: Sequelize.DECIMAL(10, 2), // 10 цифр всего, 2 после запятой
                allowNull: false,
                defaultValue: 0.00,
                validate: {
                    min: 0 // Цена не может быть отрицательной
                }
            },
            duration_days: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: {
                    min: 0 // Длительность не может быть отрицательной
                }
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true // По умолчанию тариф активен
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
        await queryInterface.dropTable('Tariffs');
    }
};