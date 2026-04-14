// backend/models/promocode.js
'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Promocode extends Model {
        static associate(models) {
            Promocode.hasMany(models.UserPromocode, { foreignKey: 'promocode_id', as: 'activations' });
        }
    }
    Promocode.init({
        code: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true // Промокод должен быть уникальным
        },
        discount_percentage: {
            type: DataTypes.DECIMAL(5, 2), // Например, 10.00 для 10%
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0,
                max: 100 // Скидка не может быть отрицательной или больше 100%
            }
        },
        usage_limit: {
            type: DataTypes.INTEGER,
            allowNull: true // Может быть null, если нет лимита
        },        
        expires_at: {
            type: DataTypes.DATE,
            allowNull: true // Может быть null, если нет срока годности
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        sequelize,
        modelName: 'Promocode',
        tableName: 'Promocodes', // Явно указываем имя таблицы
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });
    return Promocode;
};