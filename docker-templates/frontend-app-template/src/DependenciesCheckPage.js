// /root/install-wizard/docker-templates/frontend-app-template/src/DependenciesCheckPage.js

import React, { useState, useEffect } from 'react';
import './DependenciesCheckPage.css';

function DependenciesCheckPage({ onDependenciesReady }) {
    const [dockerStatus, setDockerStatus] = useState('Проверка...');
    const [composeStatus, setComposeStatus] = useState('Проверка...');
    const [nodeStatus, setNodeStatus] = useState('Проверка...');
    const [allDependenciesMet, setAllDependenciesMet] = useState(false);
    
    const [dockerVersion, setDockerVersion] = useState('');
    const [composeVersion, setComposeVersion] = useState('');
    const [nodeVersion, setNodeVersion] = useState('');

    useEffect(() => {
        // Эта функция будет делать реальный запрос к бэкенду
        const checkDependencies = async () => {
            try {
                const response = await fetch('/api/check-dependencies');
                const data = await response.json();

                setDockerStatus(data.docker.installed ? 'Установлено' : 'Не установлено');
                setDockerVersion(data.docker.version);

                setComposeStatus(data.dockerCompose.installed ? 'Установлен' : 'Не установлен');
                setComposeVersion(data.dockerCompose.version);

                setNodeStatus(data.nodejs.installed ? 'Установлен' : 'Не установлен');
                setNodeVersion(data.nodejs.version);

                setAllDependenciesMet(data.allDependenciesMet);

                // Если все зависимости мет, можно вызвать onDependenciesReady,
                // но в данном гибридном мастере это, возможно, не приведет к глобальному переходу шага
                // (это будет делать public/script.js)
                if (data.allDependenciesMet && onDependenciesReady) {
                    // onDependenciesReady(); // Этот вызов может быть избыточен, если public/script.js управляет переходом
                }

            } catch (error) {
                console.error('Ошибка при проверке зависимостей (React):', error);
                setDockerStatus('Ошибка');
                setComposeStatus('Ошибка');
                setNodeStatus('Ошибка');
                setAllDependenciesMet(false);
            }
        };

        checkDependencies(); // Запускаем проверку при монтировании компонента
    }, [onDependenciesReady]); // onDependenciesReady в зависимостях, если он меняется

    return (
        <div className="dependencies-check-page">
            <h2>Шаг 1: Проверка зависимостей системы</h2>
            <div className="status-section">
                <p>Docker: <span style={{ color: dockerStatus === 'Установлено' ? 'green' : 'red' }}>{dockerStatus}</span> (Версия: {dockerVersion || 'Неизвестно'})</p>
                <p>Docker Compose: <span style={{ color: composeStatus === 'Установлен' ? 'green' : 'red' }}>{composeStatus}</span> (Версия: {composeVersion || 'Неизвестно'})</p>
                <p>Node.js: <span style={{ color: nodeStatus === 'Установлен' ? 'green' : 'red' }}>{nodeStatus}</span> (Версия: {nodeVersion || 'Неизвестно'})</p>
            </div>
            {!allDependenciesMet && (
                <div className="error-message">
                    Пожалуйста, установите или настройте все необходимые зависимости.
                </div>
            )}
            {allDependenciesMet && (
                <div className="success-message">
                    Все зависимости успешно проверены.
                    {/* Кнопка "Продолжить" здесь может быть, но основная будет из public/index.html */}
                    {/* <button onClick={onDependenciesReady}>Продолжить</button> */}
                </div>
            )}
        </div>
    );
}

export default DependenciesCheckPage;
