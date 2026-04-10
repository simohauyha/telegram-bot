// backend/src/index.js
require('dotenv').config();

const express = require('express');
const { sequelize } = require('../models'); // Только sequelize, модели импортируем в сервисах
const initializeBot = require('./bot'); // Импортируем инициализатор бота

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Telegram Bot Backend is running!');
});

// Инициализация бота
let botInstance; // Изменено имя переменной
if (process.env.TELEGRAM_BOT_TOKEN) {
    botInstance = initializeBot(); // Вызываем функцию инициализации бота
    if (botInstance) { // Проверяем, успешно ли инициализирован бот
        console.log('✅ Telegram бот успешно инициализирован и начал получать обновления.');
    } else {
        console.error('❌ Ошибка: Не удалось инициализировать Telegram бота из-за отсутствия токена. Приложение будет остановлено.');
        process.exit(1); // Завершаем процесс приложения, так как бот является критически важной частью.
    }
} else {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: TELEGRAM_BOT_TOKEN не установлен. Бот не будет запущен, приложение остановлено.');
    process.exit(1); // Завершаем процесс, если токен не найден
}

sequelize.authenticate()
    .then(() => {
        app.listen(PORT, async () => {
            console.log(`🚀 Сервер запущен на порту ${PORT}`);
            
            try {
                await sequelize.authenticate(); // Проверка подключения к БД                
                // Теперь, когда все критические зависимости проверены, можно объявить сервер запущенным.
                console.log('✅ Подключение к базе данных успешно установлено.');
                // ВАЖНО: Мы не используем sequelize.sync() здесь.
                // Миграции должны запускаться отдельно перед стартом приложения.
            } catch (err) {
                console.error('❌ Ошибка подключения к базе данных:', err);
                console.error('Приложение будет остановлено, так как база данных является критической зависимостью.');
                process.exit(1); // Завершаем процесс, если не удалось подключиться к БД
            }
        });
    })
    .catch(err => {
        console.error('❌ Ошибка подключения к базе данных:', err);
        console.error('Приложение будет остановлено, так как база данных является критической зависимостью.');
        process.exit(1); // Завершаем процесс, если не удалось подключиться к БД
    });

module.exports = { app, bot: botInstance }; // Экспортируем botInstance