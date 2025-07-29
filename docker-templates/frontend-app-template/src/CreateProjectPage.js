import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './CreateProjectPage.css';

function CreateProjectPage() {
    const navigate = useNavigate();
    const [createProjectError, setCreateProjectError] = useState(null);
    const [projectName, setProjectName] = useState('');
    const [nginxPort, setNginxPort] = useState('');
    const [backendPort, setBackendPort] = useState('');
    const [frontendPort, setFrontendPort] = useState('');
    const [includePostgres, setIncludePostgres] = useState(true);
    const [dbName, setDbName] = useState('');
    const [dbUser, setDbUser] = useState('');
    const [dbPassword, setDbPassword] = useState('');
    const [dbPort, setDbPort] = useState(''); // Получаем его из API now

    const [includeMikopbxFirst, setIncludeMikopbxFirst] = useState(false);
    const [includeMikopbxSecond, setIncludeMikopbxSecond] = useState(false);

    const fetchAvailablePortsAndDbInfo = useCallback(async () => {
        setCreateProjectError(null);
        try {
            const response = await fetch('/api/generate-available-ports');
            if (!response.ok) {
                throw new Error('Failed to fetch available ports');
            }
            const data = await response.json();
            setNginxPort(data.nginxPort);
            setBackendPort(data.backendPort);
            setFrontendPort(data.frontendPort);
            setDbPort(data.dbPort); // Устанавливаем dbPort
        }
        catch (err) {
            console.error("Error fetching available ports:", err);
            setCreateProjectError(`Ошибка получения портов: ${err.message}`);
        }

        try {
            const response = await fetch('/api/generate-db-credentials');
            if (!response.ok) {
                throw new Error('Failed to fetch DB credentials');
            }
            const data = await response.json();
            setDbName(data.dbName);
            setDbUser(data.dbUser);
            setDbPassword(data.dbPassword);
        }
        catch (err) {
            console.error("Error fetching DB credentials:", err);
            // Если ошибка получения данных БД, не перезаписываем общую ошибку портов
            if (!createProjectError) {
                 setCreateProjectError(`Ошибка получения данных БД: ${err.message}`);
            }
        }
    }, [createProjectError]);

    useEffect(() => {
        fetchAvailablePortsAndDbInfo();
    }, [fetchAvailablePortsAndDbInfo]);


    const handleCreateProject = async (e) => {
        e.preventDefault();
        setCreateProjectError(null);

        if (!projectName) {
            setCreateProjectError('Имя проекта не может быть пустым.');
            return;
        }

        try {
            const response = await fetch('/api/generate-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectName,
                    nginxPort: parseInt(nginxPort, 10),
                    backendPort: parseInt(backendPort, 10),
                    frontendPort: parseInt(frontendPort, 10),
                    includeMikopbxFirst,
                    includeMikopbxSecond,
                    includePostgres,
                    dbName: includePostgres ? dbName : null,
                    dbUser: includePostgres ? dbUser : null,
                    dbPassword: includePostgres ? dbPassword : null,
                    dbPort: includePostgres ? parseInt(dbPort, 10) : null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create project');
            }

            const data = await response.json();
            alert(`Проект "${projectName}" создан успешно! ID: ${data.projectId}`);
            // Очистка формы
            setProjectName('');
            setIncludeMikopbxFirst(false);
            setIncludeMikopbxSecond(false);
            setIncludePostgres(true);
            fetchAvailablePortsAndDbInfo(); // Обновить предлагаемые порты и данные БД
            navigate(`/project/${data.projectId}`); // Переход на страницу деталей созданного проекта
        } catch (err) {
            console.error('Error creating project:', err);
            setCreateProjectError(`Ошибка создания проекта: ${err.message}`);
        }
    };

    return (
        <div className="page-container create-project-page">
            <h1>Создать новый проект</h1>
            <form onSubmit={handleCreateProject}>
                <div className="form-group">
                    <label htmlFor="projectName">Имя проекта:</label>
                    <input
                        type="text"
                        id="projectName"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="nginxPort">Порт Nginx (Front-end):</label>
                    <input
                        type="number"
                        id="nginxPort"
                        value={nginxPort}
                        onChange={(e) => setNginxPort(e.target.value)}
                        required
                        min="1024"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="frontendPort">Порт Frontend (внутренний, для связи с Nginx):</label>
                    <input
                        type="number"
                        id="frontendPort"
                        value={frontendPort}
                        onChange={(e) => setFrontendPort(e.target.value)}
                        required
                        min="1024"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="backendPort">Порт Backend:</label>
                    <input
                        type="number"
                        id="backendPort"
                        value={backendPort}
                        onChange={(e) => setBackendPort(e.target.value)}
                        required
                        min="1024"
                    />
                </div>

                <div className="form-group checkbox-group">
                    <input
                        type="checkbox"
                        id="includePostgres"
                        checked={includePostgres}
                        onChange={(e) => setIncludePostgres(e.target.checked)}
                    />
                    <label htmlFor="includePostgres">Включить PostgreSQL</label>
                </div>

                {includePostgres && (
                    <div className="db-details">
                        <h4>Настройки PostgreSQL:</h4>
                        <div className="form-group">
                            <label htmlFor="dbName">Имя БД:</label>
                            <input type="text" id="dbName" value={dbName} onChange={(e) => setDbName(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="dbUser">Пользователь БД:</label>
                            <input type="text" id="dbUser" value={dbUser} onChange={(e) => setDbUser(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="dbPassword">Пароль БД:</label>
                            <input type="text" id="dbPassword" value={dbPassword} onChange={(e) => setDbPassword(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="dbPort">Порт БД (внешний):</label>
                            <input type="number" id="dbPort" value={dbPort} onChange={(e) => setDbPort(e.target.value)} required min="1024" />
                        </div>
                        <button type="button" onClick={fetchAvailablePortsAndDbInfo} className="small-button">Сгенерировать новые данные БД и порты</button>
                    </div>
                )}

                <div className="form-group checkbox-group">
                    <input
                        type="checkbox"
                        id="includeMikopbxFirst"
                        checked={includeMikopbxFirst}
                        onChange={(e) => setIncludeMikopbxFirst(e.target.checked)}
                    />
                    <label htmlFor="includeMikopbxFirst">Включить MikoPBX First (SSH: 123, Web: 8080/8443)</label>
                </div>

                <div className="form-group checkbox-group">
                    <input
                        type="checkbox"
                        id="includeMikopbxSecond"
                        checked={includeMikopbxSecond}
                        onChange={(e) => setIncludeMikopbxSecond(e.target.checked)}
                    />
                    <label htmlFor="includeMikopbxSecond">Включить MikoPBX Second (SSH: 2223, Web: 8081/9443)</label>
                </div>

                {createProjectError && <p className="error-message">{createProjectError}</p>}

                <button type="submit" className="submit-button">Создать проект</button>
            </form>
        </div>
    );
}

export default CreateProjectPage;
