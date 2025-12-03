FROM node:18-alpine

WORKDIR /app

# Copy utils directory from root
COPY utils/ ./utils/

# Install dependencies for WORKSPACE service
COPY services/workspace/package*.json ./
RUN npm install --only=production --no-audit --no-fund

# Copy WORKSPACE application code
COPY services/workspace/ ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "index.js"]

