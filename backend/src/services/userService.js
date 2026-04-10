// backend/src/services/userService.js
const { User } = require('../../models');

const userService = {
    async findOrCreateUser(userData) {
        return User.findOrCreate({
            where: { telegram_id: userData.telegram_id },
            defaults: userData
        });
    },
    async findUserByTelegramId(telegram_id) {
        return User.findOne({ where: { telegram_id } });
    }
    // Здесь будут другие методы для работы с пользователями
};

module.exports = userService;