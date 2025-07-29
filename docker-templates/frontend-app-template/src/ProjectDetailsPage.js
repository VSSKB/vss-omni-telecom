import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import './ProjectDetailsPage.css';

function ProjectDetailsPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [projectDetails, setProjectDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [logs, setLogs] = useState([]);
    const [isSocketConnected, setIsSocketConnected] = useState(false);
    const [commandExecuting, setCommandExecuting] = useState(false);
    const [createVssUserMessage, setCreateVssUserMessage] = useState(null);
    const [createVssUserError, setCreateVssUserError] = useState(null);
    const [vssUsername, setVssUsername] = useState('');
    const [vssPassword, setVssPassword] = useState('');

    const socketRef = useRef(null); // Используем useRef для socket
    const logOutputRef = useRef(null); // Для автоматической прокрутки логов

    const connectSocket = useCallback(() => {
        if (!socketRef.current) {
            socketRef.current = io(); // Подключение к серверу Socket.IO
            socketRef.current.on('connect', () => {
                setIsSocketConnected(true);
                console.log('Socket.IO connected');
            });

            socketRef.current.on('disconnect', () => {
                setIsSocketConnected(false);
                console.log('Socket.IO disconnected');
            });

            socketRef.current.on('project_log', (log) => {
                setLogs(prevLogs => [...prevLogs, log]);
            });

            socketRef.current.on('command_finished', () => {
                console.log('Command finished signal received.');
                setCommandExecuting(false);
                fetchProjectDetails(); // Обновляем статус после завершения команды
            });
        }
    }, [fetchProjectDetails]);

    useEffect(() => {
        connectSocket(); // Устанавливаем соединение при монтировании

        return () => {
            if (socketRef.current) {
                socketRef.current.emit('stop_logs', projectId); // Останавливаем логи при размонтировании
                socketRef.current.disconnect();
                socketRef.current = null; // Очищаем реф
            }
        };
    }, [connectSocket, projectId]);

    useEffect(() => {
        if (logOutputRef.current) {
            logOutputRef.current.scrollTop = logOutputRef.current.scrollHeight;
        }
    }, [logs]);


    const fetchProjectDetails = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/project-details/${projectId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch project details');
            }
            const data = await response.json();
            setProjectDetails(data);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching project details:", err);
            setError(`Ошибка загрузки деталей проекта: ${err.message}`);
            setLoading(false);
        }
    }, [projectId]);

    const executeProjectCommand = useCallback(async (action) => {
        setCommandExecuting(true);
        setError(null);
        setLogs([]); // Очищаем логи перед новой командой
        if (socketRef.current && isSocketConnected) {
            socketRef.current.emit('request_logs', projectId); // Запрашиваем логи
        }

        try {
            const response = await fetch(`/api/${action}-project`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to ${action} project`);
            }
            // Успех команды будет обработан через socket.on('command_finished')
        } catch (err) {
            console.error(`Error ${action}ing project:`, err);
            setError(`Ошибка выполнения команды "${action}": ${err.message}`);
            if (socketRef.current && isSocketConnected) {
                socketRef.current.emit('project_log', `\n--- Ошибка: ${err.message} ---\n`);
                socketRef.current.emit('command_finished'); // Уведомляем об ошибке и завершении
            } else {
                setCommandExecuting(false);
            }
        }
    }, [projectId, isSocketConnected]);

    const handleDeletePostgres = useCallback(async () => {
        if (!window.confirm(`Вы уверены, что хотите удалить PostgreSQL из проекта "${projectDetails.projectName}"? Это удалит все данные БД!`)) {
            return;
        }

        setCommandExecuting(true);
        setError(null);
        setLogs([]);
        if (socketRef.current && isSocketConnected) {
            socketRef.current.emit('request_logs', projectId);
        }

        try {
            const response = await fetch(`/api/delete-postgres`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete PostgreSQL');
            }
            // Успех будет обработан через command_finished
            alert(`Команда удаления PostgreSQL отправлена. Пожалуйста, дождитесь завершения в логах.`);
        } catch (err) {
            console.error("Error deleting PostgreSQL:", err);
            setError(`Ошибка удаления PostgreSQL: ${err.message}`);
            if (socketRef.current && isSocketConnected) {
                 socketRef.current.emit('project_log', `\n--- Ошибка: ${err.message} ---\n`);
                 socketRef.current.emit('command_finished');
            } else {
                 setCommandExecuting(false);
            }
        }
    }, [projectId, projectDetails, isSocketConnected]);


    const handleDeleteProject = useCallback(async () => {
        if (!window.confirm(`Вы уверены, что хотите полностью удалить проект "${projectDetails.projectName}"? Это необратимо!`)) {
            return;
        }

        setCommandExecuting(true);
        setError(null);
        setLogs([]);
        if (socketRef.current && isSocketConnected) {
            socketRef.current.emit('request_logs', projectId);
        }

        try {
            const response = await fetch(`/api/delete-project`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete project');
            }
            alert(`Команда удаления проекта отправлена. Пожалуйста, дождитесь завершения в логах.`);
            // После успешного удаления бэкенд перенаправит на главную
            // navigate('/'); // Переход на главную страницу после удаления
        } catch (err) {
            console.error("Error deleting project:", err);
            setError(`Ошибка удаления проекта: ${err.message}`);
            if (socketRef.current && isSocketConnected) {
                 socketRef.current.emit('project_log', `\n--- Ошибка: ${err.message} ---\n`);
                 socketRef.current.emit('command_finished');
            } else {
                 setCommandExecuting(false);
            }
        }
    }, [projectId, projectDetails, isSocketConnected, navigate]);

    const handleCreateVssUser = async (e) => {
        e.preventDefault();
        setCreateVssUserError(null);
        setCreateVssUserMessage(null);
        if (!vssUsername || !vssPassword) {
            setCreateVssUserError('Пожалуйста, введите логин и пароль.');
            return;
        }

        // Вызываем API на бэкенде install-wizard, который, в свою очередь, может вызвать API бэкенда проекта
        try {
            const response = await fetch('/api/create-vss-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, username: vssUsername, password: vssPassword }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create VSS user');
            }
            const data = await response.json();
            setCreateVssUserMessage(data.message);
            setVssUsername('');
            setVssPassword('');
        } catch (err) {
            setCreateVssUserError(`Ошибка создания пользователя VSS: ${err.message}`);
        }
    };

    const handlePullDockerImage = async (imageName) => {
        setCommandExecuting(true);
        setError(null);
        setLogs([]);
        if (socketRef.current && isSocketConnected) {
            socketRef.current.emit('request_logs', projectId); // Начать трансляцию логов, привязав к проекту
        }

        try {
            const response = await fetch('/api/pull-docker-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageName, projectId }), // Передаем projectId, чтобы логи шли в нужную комнату
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to pull image ${imageName}`);
            }
            // Успех будет обработан через socket.on('command_finished')
            alert(`Команда загрузки образа "${imageName}" отправлена. Пожалуйста, дождитесь завершения в логах.`);
        } catch (err) {
            console.error(`Error pulling image ${imageName}:`, err);
            setError(`Ошибка загрузки образа ${imageName}: ${err.message}`);
            if (socketRef.current && isSocketConnected) {
                socketRef.current.emit('project_log', `\n--- Ошибка: ${err.message} ---\n`);
                socketRef.current.emit('command_finished');
            } else {
                setCommandExecuting(false);
            }
        }
    };


    useEffect(() => {
        fetchProjectDetails(); // Начальная загрузка деталей проекта

        // Запрашиваем логи только если commandExecuting true, иначе это будет лишний вызов
        // Логи будут запрошены в executeProjectCommand
        // Можно добавить setInterval для fetchProjectDetails, чтобы статус обновлялся регулярно
        const detailsInterval = setInterval(fetchProjectDetails, 5000);
        return () => clearInterval(detailsInterval);
    }, [fetchProjectDetails]);


    if (loading) {
        return <div className="page-container">Загрузка деталей проекта...</div>;
    }

    if (error) {
        return (
            <div className="page-container error-page">
                <h2>Ошибка</h2>
                <p className="error-message">{error}</p>
                <button onClick={fetchProjectDetails} className="action-button">Повторить попытку</button>
                <button onClick={() => navigate('/')} className="action-button">К списку проектов</button>
            </div>
        );
    }

    if (!projectDetails) {
        return (
            <div className="page-container">
                <p>Детали проекта не найдены.</p>
                <button onClick={() => navigate('/')} className="action-button">К списку проектов</button>
            </div>
        );
    }

    // Вспомогательная функция для получения статуса сервиса
    const getServiceStatusText = (serviceName) => {
        const status = projectDetails.serviceStatus[serviceName];
        if (status === 'running') return <span style={{ color: 'green' }}>Запущен</span>;
        if (status === 'stopped') return <span style={{ color: 'red' }}>Остановлен</span>;
        if (status === 'unknown') return <span style={{ color: 'orange' }}>Неизвестен/Не активен</span>;
        return <span style={{ color: 'gray' }}>N/A</span>;
    };

    const showStartButton = projectDetails.status === 'stopped' || projectDetails.status === 'error' || projectDetails.status === 'configuration_error' || projectDetails.status === 'compose_file_missing' || projectDetails.status === 'partial_running' || projectDetails.status === 'empty_compose';
    const showStopButton = projectDetails.status === 'running' || projectDetails.status === 'partial_running';

    return (
        <div className="page-container project-details-page">
            <button onClick={() => navigate('/')} className="small-button back-button">&larr; К списку проектов</button>

            <h1>Детали проекта: {projectDetails.projectName}</h1>
            <p className="project-id">ID Проекта: <span>{projectDetails.id}</span></p>

            <div className="project-info-grid">
                <div className="info-box">
                    <h3>Общая информация</h3>
                    <p><strong>URL Проекта:</strong> <a href={projectDetails.projectUrl} target="_blank" rel="noopener noreferrer">{projectDetails.projectUrl}</a></p>
                    <p><strong>Путь к проекту:</strong> {projectDetails.projectPath}</p>
                    <p><strong>Статус проекта:</strong>
                        {projectDetails.status === 'running' && <span style={{ color: 'green', fontWeight: 'bold', marginLeft: '10px' }}>Запущен</span>}
                        {projectDetails.status === 'stopped' && <span style={{ color: 'red', fontWeight: 'bold', marginLeft: '10px' }}>Остановлен</span>}
                        {projectDetails.status === 'partial_running' && <span style={{ color: 'orange', fontWeight: 'bold', marginLeft: '10px' }}>Частично запущен</span>}
                        {projectDetails.status === 'error' && <span style={{ color: 'red', fontWeight: 'bold', marginLeft: '10px' }}>Ошибка</span>}
                        {projectDetails.status === 'configuration_error' && <span style={{ color: 'red', fontWeight: 'bold', marginLeft: '10px' }}>Ошибка конфигурации Docker Compose</span>}
                        {projectDetails.status === 'compose_file_missing' && <span style={{ color: 'red', fontWeight: 'bold', marginLeft: '10px' }}>Файл Docker Compose отсутствует</span>}
                        {projectDetails.status === 'empty_compose' && <span style={{ color: 'red', fontWeight: 'bold', marginLeft: '10px' }}>docker-compose.yml пуст или некорректен</span>}
                        {projectDetails.status === 'unknown' && <span style={{ color: 'gray', fontWeight: 'bold', marginLeft: '10px' }}>Неизвестен</span>}
                    </p>


                    <div className="button-group">
                        {showStartButton && (
                            <button
                                onClick={() => executeProjectCommand('start')}
                                disabled={commandExecuting}
                                className="action-button start-button"
                            >
                                {commandExecuting ? 'Запуск...' : 'Запустить проект'}
                            </button>
                        )}
                        {showStopButton && (
                            <button
                                onClick={() => executeProjectCommand('stop')}
                                disabled={commandExecuting}
                                className="action-button stop-button"
                            >
                                {commandExecuting ? 'Остановка...' : 'Остановить проект'}
                            </button>
                        )}
                        <button
                            onClick={handleDeleteProject}
                            disabled={commandExecuting}
                            className="action-button delete-button"
                        >
                            {commandExecuting ? 'Удаление...' : 'Удалить проект'}
                        </button>
                    </div>
                </div>

                <div className="info-box">
                    <h3>Порты</h3>
                    <p><strong>Nginx (HTTP):</strong> {projectDetails.nginxPort}</p>
                    <p><strong>Backend:</strong> {projectDetails.backendPort}</p>
                    <p><strong>Frontend (внутренний):</strong> {projectDetails.frontendPort}</p>
                    {projectDetails.includeMikopbxFirst && projectDetails.mikopbxFirstFixedPorts && (
                        <>
                            <h4>MikoPBX #1 (Фиксированные порты):</h4>
                            <p><strong>SSH:</strong> {projectDetails.mikopbxFirstFixedPorts.ssh}</p>
                            <p><strong>WEB:</strong> {projectDetails.mikopbxFirstFixedPorts.web}</p>
                            <p><strong>HTTPS:</strong> {projectDetails.mikopbxFirstFixedPorts.https}</p>
                        </>
                    )}
                    {projectDetails.includeMikopbxSecond && projectDetails.mikopbxSecondFixedPorts && (
                        <>
                            <h4>MikoPBX #2 (Фиксированные порты):</h4>
                            <p><strong>SSH:</strong> {projectDetails.mikopbxSecondFixedPorts.ssh}</p>
                            <p><strong>WEB:</strong> {projectDetails.mikopbxSecondFixedPorts.web}</p>
                            <p><strong>HTTPS:</strong> {projectDetails.mikopbxSecondFixedPorts.https}</p>
                        </>
                    )}
                </div>

                {projectDetails.includePostgres && projectDetails.db && (
                    <div className="info-box">
                        <h3>PostgreSQL</h3>
                        <p><strong>Имя БД:</strong> {projectDetails.db.dbName}</p>
                        <p><strong>Пользователь БД:</strong> {projectDetails.db.dbUser}</p>
                        <p><strong>Пароль БД:</strong> {projectDetails.db.dbPassword}</p>
                        <p><strong>Порт БД:</strong> {projectDetails.db.dbPort}</p>
                        <button
                            onClick={handleDeletePostgres}
                            disabled={commandExecuting}
                            className="action-button delete-button small-button"
                        >
                            Удалить PostgreSQL
                        </button>
                        <div className="create-vss-user-section">
                            <h4>Создать пользователя VSS (пример)</h4>
                            <form onSubmit={handleCreateVssUser}>
                                <div className="form-group">
                                    <label htmlFor="vssUsername">Логин:</label>
                                    <input
                                        type="text"
                                        id="vssUsername"
                                        value={vssUsername}
                                        onChange={(e) => setVssUsername(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="vssPassword">Пароль:</label>
                                    <input
                                        type="password"
                                        id="vssPassword"
                                        value={vssPassword}
                                        onChange={(e) => setVssPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                {createVssUserError && <p className="error-message">{createVssUserError}</p>}
                                {createVssUserMessage && <p className="success-message">{createVssUserMessage}</p>}
                                <button type="submit" className="small-button">Создать</button>
                            </form>
                        </div>
                    </div>
                )}

                <div className="info-box">
                    <h3>Статус сервисов</h3>
                    {projectDetails.serviceStatus && Object.keys(projectDetails.serviceStatus).length > 0 ? (
                        <ul>
                            {Object.keys(projectDetails.serviceStatus).map(service => (
                                <li key={service}>
                                    <strong>{service}:</strong> {getServiceStatusText(service)}
                                    {projectDetails.serviceStatus[service] === 'unknown' && projectDetails.serviceStatus.error && (
                                        <span style={{color: 'red', marginLeft: '10px'}}>{projectDetails.serviceStatus.error}</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>Статус сервисов недоступен или Docker Compose файл некорректен.</p>
                    )}
                    <p>Соединение с Socket.IO: {isSocketConnected ? <span style={{color: 'green'}}>Установлено</span> : <span style={{color: 'red'}}>Нет</span>}</p>
                </div>

                <div className="info-box">
                    <h3>Утилиты Docker</h3>
                    <p>Загрузить Docker образы:</p>
                    <button onClick={() => handlePullDockerImage('mikopbx/mikopbx-x86-64')} disabled={commandExecuting} className="small-button">
                        {commandExecuting ? 'Загрузка...' : 'mikopbx/mikopbx-x86-64'}
                    </button>
                    <button onClick={() => handlePullDockerImage('postgres:15-alpine')} disabled={commandExecuting} className="small-button" style={{marginLeft: '10px'}}>
                        {commandExecuting ? 'Загрузка...' : 'postgres:15-alpine'}
                    </button>
                </div>
            </div>

            <div className="log-output-section">
                <h2>Логи Docker Compose:</h2>
                <pre ref={logOutputRef} className="log-output">
                    {logs.length === 0 ? "Логи появятся здесь после запуска команд..." : logs.join('')}
                </pre>
                {commandExecuting && <p className="loading-message">Выполнение команды... Логи обновляются.</p>}
            </div>
        </div>
    );
}

export default ProjectDetailsPage;
