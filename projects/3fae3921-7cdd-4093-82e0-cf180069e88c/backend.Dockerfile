# Dockerfile для Backend (Node.js пример)

FROM node:18-alpine
WORKDIR /app

# Copy utils from root project (../../utils)
COPY ../../utils/ ./utils/

# Copy backend files
COPY backend/package*.json ./
RUN npm install --omit=dev  
COPY backend/ .

EXPOSE 3001 
CMD ["npm", "start"]
