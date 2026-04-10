// backend/models/subscription.js
'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Subscription extends Model {
        static associate(models) {
            // define association here
            Subscription.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
            Subscription.belongsTo(models.Tariff, { foreignKey: 'tariff_id', as: 'tariff' });
        }
    }
    Subscription.init({
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        tariff_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        hiddify_key: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        hiddify_uuid: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            unique: true,
            allowNull: false
        },
        start_date: {
            type: DataTypes.DATE,
            allowNull: true
        },
        end_date: {
            type: DataTypes.DATE,
            allowNull: true
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        is_paid: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, {
        sequelize,
        modelName: 'Subscription',
        tableName: 'Subscriptions', // Явно указываем имя таблицы
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });
    return Subscription;
};