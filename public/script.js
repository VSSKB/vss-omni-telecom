let currentStep = 1;
let selectedProjectIdForUserCreation = null; // Для отслеживания выбранного проекта для создания пользователя

const dependenciesStatus = {
    docker: { installed: false, version: '' },
    dockerCompose: { installed: false, version: '' },
    nodejs: { installed: false, version: '' }
};

document.addEventListener('DOMContentLoaded', () => {
    // Определяем, какая страница загружена
    if (window.location.pathname === '/dashboard') {
        // Если это страница дашборда, сразу показываем Шаг 3
        showDashboard();
    } else {
        // Иначе показываем первый шаг мастера
        showStep(currentStep);
    }

    // Инициализация полей БД как скрытых, если чекбокс не выбран
    const includePostgresCheckbox = document.getElementById('includePostgres');
    const postgresSettingsDiv = document.getElementById('postgresSettings');
    if (postgresSettingsDiv && includePostgresCheckbox) {
        // Убедимся, что начальное состояние корректно
        if (!includePostgresCheckbox.checked) {
            postgresSettingsDiv.classList.add('hidden');
            // Убираем required атрибут, если Postgres не выбран
            postgresSettingsDiv.querySelectorAll('input').forEach(input => {
                input.removeAttribute('required');
            });
        }
        includePostgresCheckbox.addEventListener('change', (event) => {
            if (event.target.checked) {
                postgresSettingsDiv.classList.remove('hidden');
                // Добавляем required атрибут, если Postgres выбран
                postgresSettingsDiv.querySelectorAll('input').forEach(input => {
                    input.setAttribute('required', 'required');
                });
            } else {
                postgresSettingsDiv.classList.add('hidden');
                // Убираем required атрибут, если Postgres не выбран
                postgresSettingsDiv.querySelectorAll('input').forEach(input => {
                    input.removeAttribute('required');
                });
            }
        });
    }

    // Привязываем обработчик для кнопки "Создать пользователя"
    const createUserButton = document.getElementById('createUserButton');
    if (createUserButton) {
        createUserButton.addEventListener('click', createUser);
        // Деактивируем кнопку по умолчанию, пока проект не выбран (только для дашборда)
        if (window.location.pathname === '/dashboard') {
            createUserButton.disabled = true;
        }
    }
});

// Функция для отображения определенного шага мастера
function showStep(step) {
    document.querySelectorAll('.card').forEach(card => {
        card.classList.add('hidden');
    });
    // Шаг 3 (Dashboard) будет загружаться отдельно
    if (step === 3) {
        window.location.href = '/dashboard';
        return;
    }
    document.getElementById(`step${step}`).classList.remove('hidden');
    currentStep = step;

    // Дополнительная логика при смене шага
    if (step === 1) {
        checkAllDependencies(); // Перепроверяем зависимости при возврате на Шаг 1
    }
}

// Переход на следующий шаг
function nextStep(stepNumber) {
    showStep(stepNumber);
}

// Переход на предыдущий шаг
function prevStep(stepNumber) {
    showStep(stepNumber);
}

// Функция для отображения дашборда (Шаг 3)
function showDashboard() {
    // Скрываем все карточки, если они есть (для совместимости)
    document.querySelectorAll('.card').forEach(card => {
        card.classList.add('hidden');
    });
    // Показываем только карточку с ID 'step3'
    const step3Card = document.getElementById('step3');
    if (step3Card) {
        step3Card.classList.remove('hidden');
        loadProjects(); // Загружаем проекты при отображении дашборда
        // Сбросим выбранный проект и деактивируем кнопку создания пользователя
        selectedProjectIdForUserCreation = null;
        const createUserButton = document.getElementById('createUserButton');
        if (createUserButton) createUserButton.disabled = true;
        // Очистим поля ввода пользователя
        document.getElementById('vssUsername').value = '';
        document.getElementById('vssPassword').value = '';
    } else {
        console.error("Элемент 'step3' не найден. Убедитесь, что dashboard.html содержит соответствующую структуру.");
    }
}


// Асинхронная функция для проверки всех зависимостей через API
async function checkAllDependencies() {
    const statusDiv = document.getElementById('dependenciesStatus');
    const nextButton = document.getElementById('nextStep1Button');
    if (statusDiv) statusDiv.innerHTML = '<p>Загрузка статуса зависимостей...</p>';
    if (nextButton) nextButton.disabled = true;

    try {
        const response = await fetch('/api/check-dependencies');
        const data = await response.json();

        dependenciesStatus.docker = data.docker;
        dependenciesStatus.dockerCompose = data.dockerCompose;
        dependenciesStatus.nodejs = data.nodejs;

        updateDependencyStatusUI();

        if (data.allDependenciesMet) {
            if (nextButton) nextButton.disabled = false;
            console.log("Все зависимости успешно проверены.");
        } else {
            if (nextButton) nextButton.disabled = true;
            console.log("Не все зависимости установлены.");
        }
    } catch (error) {
        console.error('Ошибка при проверке зависимостей:', error);
        if (statusDiv) statusDiv.innerHTML = '<p style="color: red;">Ошибка при загрузке статуса зависимостей. Проверьте сервер.</p>';
        if (nextButton) nextButton.disabled = true;
    }
}

// Функция для обновления UI статуса зависимостей
function updateDependencyStatusUI() {
    const statusDiv = document.getElementById('dependenciesStatus');
    if (!statusDiv) return;

    let htmlContent = `
        <p>Docker: <span style="color: ${dependenciesStatus.docker.installed ? 'green' : 'red'};">${dependenciesStatus.docker.installed ? 'Установлено' : 'Не установлено'}</span> (Версия: ${dependenciesStatus.docker.version || 'Неизвестно'})</p>
        <p>Docker Compose: <span style="color: ${dependenciesStatus.dockerCompose.installed ? 'green' : 'red'};">${dependenciesStatus.dockerCompose.installed ? 'Установлен' : 'Не установлен'}</span> (Версия: ${dependenciesStatus.dockerCompose.version || 'Неизвестно'})</p>
        <p>Node.js: <span style="color: ${dependenciesStatus.nodejs.installed ? 'green' : 'red'};">${dependenciesStatus.nodejs.installed ? 'Установлен' : 'Не установлен'}</span> (Версия: ${dependenciesStatus.nodejs.version || 'Неизвестно'})</p>
    `;

    if (dependenciesStatus.docker.installed && dependenciesStatus.dockerCompose.installed && dependenciesStatus.nodejs.installed) {
        htmlContent += '<p style="color: green; font-weight: bold;">Все зависимости успешно проверены.</p>';
    } else {
        htmlContent += '<p style="color: red;">Пожалуйста, установите или настройте все необходимые зависимости.</p>';
    }
    statusDiv.innerHTML = htmlContent;
}

// =======================================================
// Функции для Шага 2: Создание нового проекта
// =======================================================

async function generatePorts() {
    try {
        const response = await fetch('/api/generate-ports');
        const ports = await response.json();

        document.getElementById('nginxPort').value = ports.nginx;
        document.getElementById('backendPort').value = ports.backend;
        document.getElementById('frontendPort').value = ports.frontend;
        document.getElementById('mikopbxPort').value = ports.mikopbx;
        document.getElementById('dbPort').value = ports.db;
    } catch (error) {
        console.error('Ошибка при генерации портов:', error);
        alert('Не удалось сгенерировать порты. Проверьте сервер.');
    }
}

async function generateDbCredentials() {
    const dbNameInput = document.getElementById('dbName');
    const dbUserInput = document.getElementById('dbUser');
    const dbPasswordInput = document.getElementById('dbPassword');
    const dbPortInput = document.getElementById('dbPort');

    const generateRandomString = (length) => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };
    const getRandomPort = () => Math.floor(Math.random() * (65535 - 10000 + 1)) + 10000;

    dbNameInput.value = `vss_db_${generateRandomString(4).toLowerCase()}`;
    dbUserInput.value = `user_${generateRandomString(3).toLowerCase()}`;
    dbPasswordInput.value = generateRandomString(12);
    
    // Генерируем новый порт, если текущий пуст или не числовой
    if (!dbPortInput.value || isNaN(parseInt(dbPortInput.value))) {
        dbPortInput.value = getRandomPort();
    }


    alert('Данные PostgreSQL сгенерированы.');
}

async function generateProject() {
    const projectName = document.getElementById('projectName').value;
    if (!projectName.trim()) {
        alert('Пожалуйста, введите имя проекта.');
        return;
    }

    const nginxPort = document.getElementById('nginxPort').value;
    const backendPort = document.getElementById('backendPort').value;
    const frontendPort = document.getElementById('frontendPort').value;
    const mikopbxPort = document.getElementById('mikopbxPort').value;
    
    // Проверка, что все порты заполнены и являются числами
    if (!nginxPort || isNaN(parseInt(nginxPort)) ||
        !backendPort || isNaN(parseInt(backendPort)) ||
        !frontendPort || isNaN(parseInt(frontendPort)) ||
        !mikopbxPort || isNaN(parseInt(mikopbxPort))) {
        alert('Пожалуйста, заполните все обязательные поля портов корректными числами.');
        return;
    }


    const includeMikopbx = document.getElementById('includeMikopbx').checked;
    const includePostgres = document.getElementById('includePostgres').checked;

    let dbData = undefined;
    if (includePostgres) {
        const dbName = document.getElementById('dbName').value;
        const dbUser = document.getElementById('dbUser').value;
        const dbPassword = document.getElementById('dbPassword').value;
        const dbPort = document.getElementById('dbPort').value;

        if (!dbName.trim() || !dbUser.trim() || !dbPassword.trim() || !dbPort.trim() || isNaN(parseInt(dbPort))) {
            alert('Пожалуйста, заполните все обязательные поля для PostgreSQL корректными данными.');
            return;
        }
        dbData = { dbName, dbUser, dbPassword, dbPort: parseInt(dbPort) };
    }

    const projectData = {
        projectName,
        ports: {
            nginx: parseInt(nginxPort),
            backend: parseInt(backendPort),
            frontend: parseInt(frontendPort),
            mikopbx: parseInt(mikopbxPort)
        },
        includeMikopbx,
        includePostgres,
        db: dbData
    };

    try {
        const response = await fetch('/api/generate-project', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(projectData)
        });

        const result = await response.json();

        if (response.ok) {
            alert(`Проект "${result.projectName}" успешно сгенерирован! ID: ${result.projectId}`);
            window.location.href = '/dashboard'; // Переход к отдельной странице дашборда
        } else {
            alert(`Ошибка при генерации проекта: ${result.message || 'Неизвестная ошибка'}\nДетали: ${result.error || ''}`);
            console.error('Ошибка генерации проекта:', result);
        }
    } catch (error) {
        console.error('Ошибка при отправке запроса:', error);
        alert('Произошла ошибка сети при попытке генерации проекта.');
    }
}

// =======================================================
// Функции для Шага 3: Управление проектами и новые секции
// =======================================================

async function loadProjects() {
    const projectListDiv = document.getElementById('projectList');
    if (!projectListDiv) return;
    projectListDiv.innerHTML = '<p>Загрузка проектов...</p>';

    try {
        const response = await fetch('/api/projects');
        const projects = await response.json();

        let projectsHtml = '';
        if (projects.length === 0) {
            projectsHtml = '<p>Проекты не найдены. Создайте новый проект на Шаге 2.</p>';
            // Если нет проектов, отключаем кнопку создания пользователя
            document.getElementById('createUserButton').disabled = true;
            selectedProjectIdForUserCreation = null;
        } else {
            projectsHtml = projects.map(project => `
                <div class="project-item" data-project-id="${project.id}" onclick="selectProjectForUserCreation('${project.id}')">
                    <span>Название проекта: ${project.name}<br>ID проекта: ${project.id}<br>Статус: <span style="color: ${project.status === 'running' ? 'green' : 'orange'};">${project.status}</span></span>
                    <div class="project-actions">
                        <button onclick="startProject(event, '${project.id}')" class="start-btn" ${project.status === 'running' ? 'disabled' : ''}>Старт</button>
                        <button onclick="stopProject(event, '${project.id}')" class="stop-btn" ${project.status === 'stopped' ? 'disabled' : ''}>Стоп</button>
                        <button onclick="openTrunkDashboard(event, '${project.id}')" class="admin-btn" style="background: #9b59b6;">Управление транками</button>
                        <button onclick="openAdminPanel(event, '${project.id}', ${project.ports.nginx})" class="admin-btn">Перейти в админку</button>
                        <button onclick="viewProjectLogs(event, '${project.id}')" class="logs-btn">Просмотр логов</button>
                        <button onclick="deleteProject(event, '${project.id}')" class="button-danger">Удалить</button>
                    </div>
                </div>
            `).join('');
            // Кнопка создания пользователя будет активирована после выбора проекта
            document.getElementById('createUserButton').disabled = true;
        }
        projectListDiv.innerHTML = projectsHtml;

        // Добавляем класс 'selected' к выбранному проекту, если он есть
        if (selectedProjectIdForUserCreation) {
            const selectedItem = document.querySelector(`.project-item[data-project-id="${selectedProjectIdForUserCreation}"]`);
            if (selectedItem) {
                selectedItem.classList.add('selected');
                document.getElementById('createUserButton').disabled = false;
            }
        }

    } catch (error) {
        console.error('Ошибка загрузки проектов:', error);
        projectListDiv.innerHTML = '<p style="color: red;">Ошибка при загрузке проектов. Проверьте сервер.</p>';
        document.getElementById('createUserButton').disabled = true;
    }
}

let selectedProjectIdForSettings = null; // Для отслеживания выбранного проекта для настроек

// Функция для выбора проекта для создания пользователя
function selectProjectForUserCreation(projectId) {
    // Снимаем выделение со всех проектов
    document.querySelectorAll('.project-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Выделяем выбранный проект
    const selectedItem = document.querySelector(`.project-item[data-project-id="${projectId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
        selectedProjectIdForUserCreation = projectId;
        selectedProjectIdForSettings = projectId; // Также выбираем для настроек
        document.getElementById('createUserButton').disabled = false; // Активируем кнопку
        document.getElementById('openSettingsButton').disabled = false; // Активируем кнопку настроек
    }
}


// Добавляем 'event' в аргументы, чтобы остановить всплытие событий
async function startProject(event, projectId) {
    event.stopPropagation(); // Останавливаем всплытие, чтобы не сработал selectProjectForUserCreation
    try {
        const response = await fetch(`/api/projects/${projectId}/start`, { method: 'POST' });
        const result = await response.json();
        if (response.ok) {
            alert(result.message);
            loadProjects();
        } else {
            alert(`Ошибка запуска: ${result.message}\nДетали: ${result.details || ''}`);
            console.error('Ошибка запуска:', result);
        }
    } catch (error) {
        console.error('Ошибка запуска проекта:', error);
        alert('Ошибка сети при попытке запуска проекта.');
    }
}

async function stopProject(event, projectId) {
    event.stopPropagation();
    try {
        const response = await fetch(`/api/projects/${projectId}/stop`, { method: 'POST' });
        const result = await response.json();
        if (response.ok) {
            alert(result.message);
            loadProjects();
        } else {
            alert(`Ошибка остановки: ${result.message}\nДетали: ${result.details || ''}`);
            console.error('Ошибка остановки:', result);
        }
    } catch (error) {
        console.error('Ошибка остановки проекта:', error);
        alert('Ошибка сети при попытке остановки проекта.');
    }
}

async function deleteProject(event, projectId) {
    event.stopPropagation();
    if (confirm(`Вы уверены, что хотите удалить проект ${projectId}? Это действие необратимо.`)) {
        try {
            const response = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
            const result = await response.json();
            if (response.ok) {
                alert(result.message);
                loadProjects();
            } else {
                alert(`Ошибка удаления: ${result.message || 'Неизвестная ошибка'}`);
                console.error('Ошибка удаления:', result);
            }
        } catch (error) {
            console.error('Ошибка удаления проекта:', error);
            alert('Ошибка сети при попытке удаления проекта.');
        }
    }
}

// Функция для открытия интерфейса управления транками
function openTrunkDashboard(event, projectId) {
    event.stopPropagation();
    window.location.href = `/project-trunk-dashboard.html?projectId=${projectId}`;
}

// Новые функции для кнопок
async function openAdminPanel(event, projectId, nginxPort) {
    event.stopPropagation();
    try {
        // Получаем информацию о проекте для проверки статуса
        const response = await fetch(`/api/projects/${projectId}/info`);
        if (response.ok) {
            const projectInfo = await response.json();
            if (projectInfo.status !== 'running') {
                if (!confirm('Проект не запущен. Запустить проект перед переходом в админку?')) {
                    return;
                }
                // Запускаем проект
                const startResponse = await fetch(`/api/projects/${projectId}/start`, { method: 'POST' });
                if (!startResponse.ok) {
                    alert('Не удалось запустить проект. Проверьте логи.');
                    return;
                }
                // Ждем немного, чтобы контейнеры запустились
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            // Формируем URL админки
            const adminUrl = projectInfo.adminUrl || `http://${window.location.hostname}:${nginxPort}`;
            
            // Открываем страницу входа вместо прямого URL
            const loginUrl = `/admin-login.html?projectId=${projectId}&adminUrl=${encodeURIComponent(adminUrl)}`;
            window.open(loginUrl, '_blank');
            console.log(`Открытие страницы входа для проекта ${projectId}, админка: ${adminUrl}`);
        } else {
            alert('Не удалось получить информацию о проекте.');
        }
    } catch (error) {
        console.error('Ошибка при открытии админки:', error);
        alert('Ошибка при открытии админки. Проверьте, что проект запущен.');
    }
}

async function viewProjectLogs(event, projectId) {
    event.stopPropagation();
    
    try {
        // Показываем индикатор загрузки
        showLogsModal(projectId, 'Загрузка логов...', true);
        
        // Получаем информацию о проекте для списка сервисов
        const infoResponse = await fetch(`/api/projects/${projectId}/info`);
        let services = [];
        if (infoResponse.ok) {
            const projectInfo = await infoResponse.json();
            services = projectInfo.services || [];
        }
        
        // Получаем логи
        const logsResponse = await fetch(`/api/projects/${projectId}/logs?tail=200`);
        if (!logsResponse.ok) {
            const error = await logsResponse.json();
            showLogsModal(projectId, `Ошибка: ${error.message}`, false, services);
            return;
        }
        
        const logsData = await logsResponse.json();
        showLogsModal(projectId, logsData.logs, false, services, projectId);
    } catch (error) {
        console.error('Ошибка при получении логов:', error);
        showLogsModal(projectId, `Ошибка получения логов: ${error.message}`, false);
    }
}

// Функция для отображения модального окна с логами
function showLogsModal(projectId, logsContent, isLoading, services = [], projectIdForRefresh = null) {
    // Удаляем существующее модальное окно, если есть
    const existingModal = document.getElementById('logsModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.id = 'logsModal';
    modal.className = 'logs-modal';
    // Экранирование projectId для безопасной вставки в HTML
    const safeProjectId = escapeHtml(projectIdForRefresh || projectId);
    const safeProjectIdAttr = safeProjectId.replace(/'/g, "\\'");
    
    // Экранирование имен сервисов для безопасной вставки в HTML
    const safeServices = services.map(s => {
        const safeService = escapeHtml(s);
        const safeServiceAttr = safeService.replace(/"/g, '&quot;');
        return `<option value="${safeServiceAttr}">${safeService}</option>`;
    }).join('');
    
    modal.innerHTML = `
        <div class="logs-modal-content">
            <div class="logs-modal-header">
                <h2>Логи проекта: ${safeProjectId}</h2>
                <div class="logs-modal-controls">
                    ${services.length > 0 ? `
                        <select id="logsServiceSelect" onchange="loadServiceLogs('${safeProjectIdAttr}')">
                            <option value="">Все сервисы</option>
                            ${safeServices}
                        </select>
                    ` : ''}
                    <button onclick="refreshLogs('${safeProjectIdAttr}')" class="refresh-logs-btn">Обновить</button>
                    <button onclick="closeLogsModal()" class="close-logs-btn">&times;</button>
                </div>
            </div>
            <div class="logs-modal-body">
                <pre id="logsContent" class="logs-content">${isLoading ? 'Загрузка...' : escapeHtml(logsContent)}</pre>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Автопрокрутка вниз
    if (!isLoading) {
        const logsContentEl = document.getElementById('logsContent');
        logsContentEl.scrollTop = logsContentEl.scrollHeight;
    }
}

// Функция для закрытия модального окна
function closeLogsModal() {
    const modal = document.getElementById('logsModal');
    if (modal) {
        modal.remove();
    }
}

// Функция для обновления логов
async function refreshLogs(projectId) {
    // Проверяем, что модальное окно все еще открыто
    const modal = document.getElementById('logsModal');
    if (!modal) {
        return; // Модальное окно закрыто, прекращаем выполнение
    }
    
    const serviceSelect = document.getElementById('logsServiceSelect');
    const service = serviceSelect ? serviceSelect.value : '';
    
    try {
        const logsContentEl = document.getElementById('logsContent');
        if (!logsContentEl) {
            return; // Элемент не найден, возможно модальное окно закрыто
        }
        
        logsContentEl.textContent = 'Загрузка...';
        
        const url = `/api/projects/${projectId}/logs?tail=200${service ? `&service=${encodeURIComponent(service)}` : ''}`;
        const response = await fetch(url);
        
        // Проверяем еще раз, что элемент существует после асинхронной операции
        const logsContentElAfter = document.getElementById('logsContent');
        if (!logsContentElAfter) {
            return; // Модальное окно было закрыто во время загрузки
        }
        
        if (!response.ok) {
            const error = await response.json();
            logsContentElAfter.textContent = `Ошибка: ${error.message}`;
            return;
        }
        
        const logsData = await response.json();
        logsContentElAfter.textContent = logsData.logs;
        logsContentElAfter.scrollTop = logsContentElAfter.scrollHeight;
    } catch (error) {
        // Проверяем, что элемент все еще существует перед записью ошибки
        const logsContentEl = document.getElementById('logsContent');
        if (logsContentEl) {
            logsContentEl.textContent = `Ошибка получения логов: ${error.message}`;
        }
    }
}

// Функция для загрузки логов конкретного сервиса
async function loadServiceLogs(projectId) {
    await refreshLogs(projectId);
}

// Вспомогательная функция для экранирования HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Закрытие модального окна при клике вне его
document.addEventListener('click', function(event) {
    const modal = document.getElementById('logsModal');
    if (modal && event.target === modal) {
        closeLogsModal();
    }
});

// Функции для работы с Docker Hub
async function checkDockerLoginStatus() {
    try {
        const response = await fetch('/api/docker-login-status');
        const result = await response.json();
        
        const statusDiv = document.getElementById('dockerLoginStatus');
        const loginForm = document.getElementById('dockerLoginForm');
        const logoutForm = document.getElementById('dockerLogoutForm');
        const loggedInUser = document.getElementById('dockerLoggedInUser');
        
        if (result.loggedIn) {
            statusDiv.innerHTML = '<p style="color: green;">✅ Выполнен вход в Docker Hub</p>';
            loginForm.style.display = 'none';
            logoutForm.style.display = 'block';
            if (result.config && result.config.username) {
                loggedInUser.textContent = `Вошли как: ${result.config.username}${result.config.registry ? ` (${result.config.registry})` : ''}`;
            } else {
                loggedInUser.textContent = 'Вошли в Docker Hub';
            }
        } else {
            statusDiv.innerHTML = '<p style="color: orange;">⚠️ Не выполнен вход в Docker Hub. Для приватных образов требуется авторизация.</p>';
            loginForm.style.display = 'block';
            logoutForm.style.display = 'none';
        }
    } catch (error) {
        console.error('Ошибка проверки статуса Docker login:', error);
        document.getElementById('dockerLoginStatus').innerHTML = '<p style="color: red;">Ошибка проверки статуса</p>';
    }
}

async function dockerLogin() {
    const username = document.getElementById('dockerUsername').value;
    const password = document.getElementById('dockerPassword').value;
    const registry = document.getElementById('dockerRegistry').value;
    
    if (!username || !password) {
        alert('Пожалуйста, введите имя пользователя и пароль.');
        return;
    }
    
    try {
        const statusDiv = document.getElementById('dockerLoginStatus');
        statusDiv.innerHTML = '<p>Выполняется вход...</p>';
        
        const response = await fetch('/api/docker-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, registry: registry || undefined })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('Успешный вход в Docker Hub!');
            // Очищаем поля пароля
            document.getElementById('dockerPassword').value = '';
            // Обновляем статус
            await checkDockerLoginStatus();
        } else {
            alert(`Ошибка входа: ${result.message}\n${result.details || ''}`);
            statusDiv.innerHTML = `<p style="color: red;">Ошибка: ${result.message}</p>`;
        }
    } catch (error) {
        console.error('Ошибка входа в Docker Hub:', error);
        alert('Ошибка сети при попытке входа в Docker Hub.');
    }
}

async function dockerLogout() {
    if (!confirm('Вы уверены, что хотите выйти из Docker Hub?')) {
        return;
    }
    
    try {
        const statusDiv = document.getElementById('dockerLoginStatus');
        statusDiv.innerHTML = '<p>Выполняется выход...</p>';
        
        const response = await fetch('/api/docker-logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('Успешный выход из Docker Hub');
            await checkDockerLoginStatus();
        } else {
            alert(`Ошибка выхода: ${result.message}`);
        }
    } catch (error) {
        console.error('Ошибка выхода из Docker Hub:', error);
        alert('Ошибка сети при попытке выхода из Docker Hub.');
    }
}

// Новая функция для загрузки Docker образа (интегрирована в Шаг 3) с поддержкой авторизации
async function pullDockerImage() {
    const imageName = document.getElementById('dockerImageName').value;
    if (!imageName.trim()) {
        alert('Пожалуйста, введите имя Docker образа.');
        return;
    }
    
    try {
        const statusDiv = document.getElementById('dockerLoginStatus');
        const originalStatus = statusDiv.innerHTML;
        statusDiv.innerHTML = '<p>Загрузка образа...</p>';
        
        const response = await fetch('/api/pull-docker-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageName })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Образ ${imageName} успешно загружен!`);
            document.getElementById('dockerImageName').value = '';
            statusDiv.innerHTML = originalStatus;
        } else if (response.status === 401 || result.requiresAuth) {
            // Требуется авторизация
            const shouldLogin = confirm(`Для загрузки образа ${imageName} требуется авторизация в Docker Hub.\n\nВойти сейчас?`);
            if (shouldLogin) {
                document.getElementById('dockerLoginForm').style.display = 'block';
                await checkDockerLoginStatus();
            }
            statusDiv.innerHTML = `<p style="color: orange;">⚠️ Требуется авторизация: ${result.message}</p>`;
        } else {
            alert(`Ошибка загрузки образа: ${result.message}\n${result.details || ''}`);
            statusDiv.innerHTML = originalStatus;
        }
    } catch (error) {
        console.error('Ошибка загрузки Docker образа:', error);
        alert('Ошибка сети при попытке загрузки образа.');
        document.getElementById('dockerLoginStatus').innerHTML = '<p style="color: red;">Ошибка сети</p>';
    }
}

// Проверяем статус Docker login при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('dockerLoginStatus')) {
        checkDockerLoginStatus();
    }
});

// Новая функция для создания пользователя VSS (интегрирована в Шаг 3)
async function createUser() {
    if (!selectedProjectIdForUserCreation) {
        alert('Пожалуйста, выберите проект из списка, для которого нужно создать пользователя VSS.');
        return;
    }

    const username = document.getElementById('vssUsername').value;
    const password = document.getElementById('vssPassword').value;

    if (!username.trim() || !password.trim()) {
        alert('Пожалуйста, введите имя пользователя и пароль.');
        return;
    }

    try {
        const response = await fetch('/api/create-vss-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, projectId: selectedProjectIdForUserCreation })
        });
        const result = await response.json();
        if (response.ok) {
            alert(result.message);
            // Очищаем поля после успешного создания
            document.getElementById('vssUsername').value = '';
            document.getElementById('vssPassword').value = '';
        } else {
            alert(`Ошибка создания пользователя: ${result.message || 'Неизвестная ошибка'}`);
            console.error('Ошибка создания пользователя:', result);
        }
    } catch (error) {
        console.error('Ошибка запроса создания пользователя:', error);
        alert('Ошибка сети при попытке создания пользователя.');
    }
}

// Функции для работы с настройками проекта
async function openProjectSettings() {
    if (!selectedProjectIdForSettings) {
        alert('Пожалуйста, выберите проект из списка.');
        return;
    }

    try {
        // Получаем информацию о проекте
        const infoResponse = await fetch(`/api/projects/${selectedProjectIdForSettings}/info`);
        if (!infoResponse.ok) {
            throw new Error('Не удалось загрузить информацию о проекте');
        }
        const projectInfo = await infoResponse.json();
        
        // Получаем настройки проекта
        const settingsResponse = await fetch(`/api/projects/${selectedProjectIdForSettings}/settings`);
        if (!settingsResponse.ok) {
            throw new Error('Не удалось загрузить настройки проекта');
        }
        const settings = await settingsResponse.json();

        // Заполняем форму
        document.getElementById('settingsProjectName').textContent = projectInfo.name;
        document.getElementById('adbEnabled').checked = settings.adb?.enabled || false;
        document.getElementById('adbPath').value = settings.adb?.path || (navigator.platform.includes('Win') ? 'adb.exe' : 'adb');
        document.getElementById('adbPort').value = settings.adb?.port || 5037;
        document.getElementById('adbAutoStart').checked = settings.adb?.autoStart || false;

        // Показываем модальное окно
        document.getElementById('projectSettingsModal').style.display = 'block';
        document.getElementById('adbSettingsStatus').style.display = 'none';
    } catch (error) {
        console.error('Ошибка загрузки настроек проекта:', error);
        alert(`Ошибка загрузки настроек: ${error.message}`);
    }
}

function closeProjectSettings() {
    document.getElementById('projectSettingsModal').style.display = 'none';
}

async function saveProjectSettings() {
    if (!selectedProjectIdForSettings) {
        alert('Проект не выбран.');
        return;
    }

    const statusDiv = document.getElementById('adbSettingsStatus');
    statusDiv.style.display = 'block';
    statusDiv.className = 'message-box';
    statusDiv.innerHTML = '<p>Сохранение настроек...</p>';

    try {
        const adbSettings = {
            enabled: document.getElementById('adbEnabled').checked,
            path: document.getElementById('adbPath').value.trim(),
            port: parseInt(document.getElementById('adbPort').value) || 5037,
            autoStart: document.getElementById('adbAutoStart').checked
        };

        // Валидация
        if (adbSettings.enabled && !adbSettings.path) {
            throw new Error('Укажите путь к ADB');
        }
        if (adbSettings.port < 1024 || adbSettings.port > 65535) {
            throw new Error('Порт должен быть в диапазоне 1024-65535');
        }

        const response = await fetch(`/api/projects/${selectedProjectIdForSettings}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adb: adbSettings })
        });

        const result = await response.json();
        if (response.ok) {
            statusDiv.className = 'message-box success';
            statusDiv.innerHTML = '<p>✅ Настройки успешно сохранены!</p>';
            setTimeout(() => {
                closeProjectSettings();
            }, 1500);
        } else {
            throw new Error(result.message || 'Ошибка сохранения настроек');
        }
    } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
        statusDiv.className = 'message-box error';
        statusDiv.innerHTML = `<p>❌ Ошибка: ${error.message}</p>`;
    }
}

// Закрытие модального окна при клике вне его
window.onclick = function(event) {
    const modal = document.getElementById('projectSettingsModal');
    if (event.target === modal) {
        closeProjectSettings();
    }
}
