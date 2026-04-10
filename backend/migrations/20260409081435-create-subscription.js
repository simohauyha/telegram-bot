// backend/migrations/XXXXXXX-create-subscription.js
'use strict';
module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('Subscriptions', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            user_id: { // Изменено на user_id для соответствия snake_case
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'Users', // Имя таблицы Users
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            tariff_id: { // Изменено на tariff_id
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'Tariffs', // Имя таблицы Tariffs
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT' // Нельзя удалить тариф, если на него есть подписки
            },
            hiddify_key: { // Изменено на hiddify_key
                type: Sequelize.TEXT, // Для хранения полной ссылки VLESS URI
                allowNull: true // Изначально может быть null, пока не сгенерирован
            },
            hiddify_uuid: { // Изменено на hiddify_uuid
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4, // Генерируем UUID автоматически
                unique: true, // Должен быть уникальным для каждой подписки Hiddify
                allowNull: false
            },
            start_date: { // Изменено на start_date
                type: Sequelize.DATE,
                allowNull: true // Может быть null, пока подписка не оплачена/активирована
            },
            end_date: { // Изменено на end_date
                type: Sequelize.DATE,
                allowNull: true // Может быть null
            },
            is_active: { // Изменено на is_active
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false // По умолчанию подписка неактивна (пока не оплачена)
            },
            is_paid: { // Изменено на is_paid
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false // По умолчанию подписка не оплачена
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
        await queryInterface.dropTable('Subscriptions');
    }
};