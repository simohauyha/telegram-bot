// backend/src/bot/commands/index.js
const startCommand = require('./start');

module.exports = (bot) => {
    startCommand(bot);
    // Здесь будут регистрироваться другие команды, например, /admin
};