// backend/src/services/tariffService.js
const { Tariff } = require('../../models');

const tariffService = {
    async getActiveTariffsSortedByPrice() {
        return Tariff.findAll({
            where: { is_active: true },
            order: [['price', 'ASC']]
        });
    },
    async getTariffById(id) {
        return Tariff.findByPk(id);
    }
    // Здесь будут другие методы для работы с тарифами
};

module.exports = tariffService;