// backend/models/user.js
'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class User extends Model {
        /**
         * Helper method for defining associations.
         * This file encapsulates the definition of an association.
         * We're not using it yet, but it's good to keep.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            User.hasMany(models.Subscription, { foreignKey: 'user_id', as: 'subscriptions' });           
        }
    }
    User.init({
        telegram_id: {
            type: DataTypes.BIGINT,
            unique: true,      // Добавляем ограничение уникальности
            allowNull: false   // Добавляем ограничение, что поле не может быть null
        },
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
        username: DataTypes.STRING
    }, {
        sequelize,
        modelName: 'User',
        tableName: 'Users', // Явно указываем имя таблицы, чтобы соответствовало миграции
        timestamps: true,   // Sequelize автоматически добавит createdAt и updatedAt
        createdAt: 'created_at', // Настраиваем имена полей, если они отличаются от стандартных
        updatedAt: 'updated_at'  // Настраиваем имена полей, если они отличаются от стандартных
    });
    return User;
};