FROM node:18-alpine

WORKDIR /app

# Copy utils directory from root
COPY utils/ ./utils/

# Install dependencies for OTTB service
COPY services/ottb/package*.json ./
RUN npm install --only=production --no-audit --no-fund

# Copy OTTB application code
COPY services/ottb/ ./

# Expose port
EXPOSE 8083

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8083/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "index.js"]

