// backend/seeders/XXXXXXX-tariff-seeder.js (замените XXXXXXX на вашу временную метку)
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('Tariffs', [
      {
        name: 'Lite (1 месяц)',
        description: 'Ограниченный трафик, для базовых нужд.',
        price: 199.00,
        duration_days: 30,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Standard (3 месяца)',
        description: 'Безлимитный трафик, идеальный выбор для активных пользователей.',
        price: 499.00,
        duration_days: 90,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Pro (6 месяцев)',
        description: 'Безлимитный трафик, максимальная скорость и приоритетная поддержка.',
        price: 899.00,
        duration_days: 180,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Архивный (1 год)',
        description: 'Старый тариф, не предлагается новым клиентам.',
        price: 1500.00,
        duration_days: 365,
        is_active: false, // Этот тариф неактивен, бот его не покажет
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    // При откате сидера удаляем все вставленные тарифы
    await queryInterface.bulkDelete('Tariffs', null, {});
  }
};