// backend/models/tariff.js
'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Tariff extends Model {
        static associate(models) {
            // define association here if any
        }
    }
    Tariff.init({
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        price: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00,
            validate: {
                min: 0 // Цена не может быть отрицательной
            }
        },
        duration_days: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0 // Длительность не может быть отрицательной
            }
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        sequelize,
        modelName: 'Tariff',
        tableName: 'Tariffs', // Явно указываем имя таблицы
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });
    return Tariff;
};