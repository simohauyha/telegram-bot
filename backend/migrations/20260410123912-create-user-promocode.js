// backend/migrations/XXXXXX-create-user-promocode.js
'use strict';
module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('UserPromocodes', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'Users', // Имя таблицы Users
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            promocode_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'Promocodes', // Имя таблицы Promocodes
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT' // Нельзя удалить промокод, если он активирован
            },
            activated_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
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

        // Добавляем составной уникальный индекс
        await queryInterface.addConstraint('UserPromocodes', {
            fields: ['user_id', 'promocode_id'],
            type: 'unique',
            name: 'user_promocode_unique_constraint'
        });
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeConstraint('UserPromocodes', 'user_promocode_unique_constraint'); // Удаляем индекс при откате
        await queryInterface.dropTable('UserPromocodes');
    }
};