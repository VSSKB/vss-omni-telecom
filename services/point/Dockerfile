FROM node:18-alpine

WORKDIR /app

# Copy utils directory from root
COPY utils/ ./utils/

# Install dependencies for POINT service
COPY services/point/package*.json ./
RUN npm install --only=production --no-audit --no-fund

# Copy POINT application code
COPY services/point/ ./

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8081/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "index.js"]

