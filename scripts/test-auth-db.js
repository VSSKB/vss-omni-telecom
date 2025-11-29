#!/usr/bin/env node
/**
 * Тестовый скрипт для проверки работы базы данных авторизации
 */

const authDB = require('../database/auth-db');

async function testAuthDB() {
    console.log('Тестирование базы данных авторизации...\n');
    
    try {
        // 1. Инициализация
        console.log('1. Инициализация базы данных...');
        await authDB.ensureInitialized();
        console.log('   ✅ База данных инициализирована\n');
        
        // 2. Получение списка пользователей
        console.log('2. Получение списка пользователей...');
        const users = await authDB.getAllUsers();
        console.log(`   ✅ Найдено пользователей: ${users.length}`);
        users.forEach(user => {
            console.log(`      - ${user.username} (${user.role})`);
        });
        console.log('');
        
        // 3. Тест аутентификации
        console.log('3. Тест аутентификации...');
        try {
            const user = await authDB.authenticateUser('admin', 'admin123', '127.0.0.1', 'test');
            console.log(`   ✅ Аутентификация успешна: ${user.username} (${user.role})\n`);
        } catch (error) {
            console.log(`   ❌ Ошибка аутентификации: ${error.message}\n`);
        }
        
        // 4. Тест создания сессии
        console.log('4. Тест создания сессии...');
        try {
            const session = await authDB.createSession(1, 'test-project', '127.0.0.1', 'test', 1);
            console.log(`   ✅ Сессия создана: ${session.sessionId}\n`);
            
            // 5. Тест проверки сессии
            console.log('5. Тест проверки сессии...');
            const validated = await authDB.validateSession(session.sessionId);
            if (validated) {
                console.log(`   ✅ Сессия валидна: ${validated.username}\n`);
            } else {
                console.log('   ❌ Сессия не валидна\n');
            }
        } catch (error) {
            console.log(`   ❌ Ошибка работы с сессией: ${error.message}\n`);
        }
        
        console.log('✅ Все тесты завершены');
        process.exit(0);
    } catch (error) {
        console.error('❌ Критическая ошибка:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testAuthDB();

