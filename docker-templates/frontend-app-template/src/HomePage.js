import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './HomePage.css'; // Импортируем новый CSS

function HomePage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loadingProjects, setLoadingProjects] = useState(true);

    const fetchProjects = useCallback(async () => {
        try {
            const response = await fetch('/api/projects');
            if (!response.ok) {
                throw new Error('Failed to fetch projects');
            }
            const data = await response.json();
            setProjects(data);
            setLoadingProjects(false);
        }
        catch (err) {
            console.error("Error fetching projects:", err);
            setLoadingProjects(false);
            // Можно добавить сообщение об ошибке, если нужно
        }
    }, []);

    useEffect(() => {
        fetchProjects();
        // Обновляем список проектов каждые 5 секунд
        const interval = setInterval(fetchProjects, 5000);
        return () => clearInterval(interval); // Очистка интервала при размонтировании компонента
    }, [fetchProjects]);

    return (
        <div className="page-container home-page">
            <h1>Панель управления проектами VSS</h1>

            <div className="actions-section">
                <h2>Действия:</h2>
                <div className="action-buttons">
                    <Link to="/create-project" className="action-button">
                        Создать новый проект
                    </Link>
                    <Link to="/check-dependencies" className="action-button">
                        Проверка зависимостей
                    </Link>
                </div>
            </div>

            <hr style={{ margin: '40px 0', borderColor: '#eee' }} />

            <div className="projects-list-section">
                <h2>Существующие проекты</h2>
                {loadingProjects ? (
                    <p>Загрузка проектов...</p>
                ) : projects.length === 0 ? (
                    <p>Проекты пока не созданы. <Link to="/create-project">Создайте первый проект!</Link></p>
                ) : (
                    <ul className="project-list">
                        {projects.map((project) => (
                            <li key={project.id} className="project-item" onClick={() => navigate(`/project/${project.id}`)}>
                                <h3>{project.projectName}</h3>
                                <p>ID: {project.id}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default HomePage;
