# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source files
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove devDependencies
RUN npm prune --production

# Create data directory
RUN mkdir -p /app/data

# Copy public files
COPY public ./public

# Initialize database on first run (if it doesn't exist)
RUN if [ ! -f /app/data/deckworthy.db ]; then node dist/db/init.js; fi

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/index.js"]
