// backend/models/userpromocode.js
'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class UserPromocode extends Model {
        static associate(models) {
            UserPromocode.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
            UserPromocode.belongsTo(models.Promocode, { foreignKey: 'promocode_id', as: 'promocode' });
            UserPromocode.belongsTo(models.Subscription, { foreignKey: 'applied_to_subscription_id', as: 'appliedSubscription' });
        }
    }
    UserPromocode.init({
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: 'user_promocode_unique' // Составной уникальный ключ
        },
        promocode_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: 'user_promocode_unique' // Составной уникальный ключ
        },
        activated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        is_applied: { // <-- ДОБАВИТЬ ЭТО ПОЛЕ: Промокод был успешно применён к оплаченной подписке
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        applied_to_subscription_id: { // <-- ДОБАВИТЬ ЭТО ПОЛЕ: ID подписки, к которой применён
            type: DataTypes.INTEGER,
            allowNull: true, // Может быть null, пока не применён
            unique: true // Один промокод активированный пользователем, может быть применен только к одной подписке
        }
    }, {
        sequelize,
        modelName: 'UserPromocode',
        tableName: 'UserPromocodes', // Явно указываем имя таблицы
        timestamps: true, // Включаем createdAt и updatedAt
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });
    return UserPromocode;
};