// /root/install-wizard/docker-templates/frontend-app-template/src/App.js

import React, { useState } from 'react';
import './App.css';
import DependenciesCheckPage from './DependenciesCheckPage';
import CreateProjectPage from './CreateProjectPage';
import HomePage from './HomePage';
import ProjectDetailsPage from './ProjectDetailsPage';

function App() {
    // Состояние для управления шагами в React-части (если она управляет собственной навигацией)
    // Изначально предположим, что начинается с HomePage или DependenciesCheckPage
    const [wizardStep, setWizardStep] = useState('home'); // Или 'dependenciesCheck'

    // Функция, которая вызывается, когда зависимости готовы в DependenciesCheckPage
    const handleDependenciesReady = () => {
        console.log("App.js: DependenciesCheckPage сообщил о готовности React-части. Переход на CreateProjectPage.");
        setWizardStep('createProject'); // Переключаем React-часть на следующий шаг
    };

    // Функция для рендеринга текущего React-компонента в зависимости от состояния wizardStep
    const renderCurrentPage = () => {
        switch (wizardStep) {
            case 'dependenciesCheck':
                return <DependenciesCheckPage onDependenciesReady={handleDependenciesReady} />;
            case 'createProject':
                return <CreateProjectPage />;
            case 'home':
                return <HomePage />;
            case 'projectDetails':
                return <ProjectDetailsPage />;
            default:
                return <HomePage />; // По умолчанию или если не определено
        }
    };

    return (
        <div className="App">
            {/* Здесь будет рендериться React-часть.
                Если public/index.html отображает свой UI, а React-приложение встраивается в него,
                то App.js будет управлять только встроенной частью.
                Если React-приложение - это основной UI, то эта структура актуальна.
                Судя по всему, ваш React-фронтенд - это одностраничное приложение, которое может
                встраиваться в public/index.html, либо public/index.html - это просто заглушка
                или часть инициализации.
                Поскольку public/script.js управляет основной навигацией, этот App.js будет отвечать
                только за внутренние компоненты, которые он сам рендерит.
                */}
            {renderCurrentPage()}
        </div>
    );
}

export default App;
