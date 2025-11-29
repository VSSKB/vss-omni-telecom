FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production --no-audit --no-fund

COPY . .

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8081/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "index.js"]

