# admin-backend/Dockerfile
# Используем официальный образ Node.js
FROM node:18-alpine

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# Копируем package.json и package-lock.json для установки зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальное содержимое приложения
COPY . .

# Открываем порт, на котором будет слушать Node.js сервер
EXPOSE 8181

# Команда для запуска приложения
CMD ["npm", "start"]
